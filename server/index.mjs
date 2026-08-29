import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { spawn } from "node:child_process";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addEvent, advancePartySpotlight, buildLobby, createDatabase, createParty, createPlayer, createWorld, deletePlayer, getActiveAdventure, getGuidanceMode, getKnownLocations, getLevelUpOptions, getParty, getPartySpotlight, getPartyState, getPlayerByToken, getPlayerGuidance, levelUpPlayer, listInventory, listPlayers, listVisibleEvents, loginPlayer, movePlayerToParty, resetPartyStory, selectAdventure, setGuidanceMode, setPartySpotlight } from "./database.mjs";
import { actionUsesSpotlight, canSubmitOutsideCombat, normalizeSpeechAudience } from "./spotlight.mjs";
import { generateCharacterDetail, refreshPlayerGuidance, resolveAction, resolvePendingCheck } from "./dm.mjs";
import { currentModelProfile, modelRuntimeView, selectAndLoadModel } from "./model-runtime.mjs";
import { cottonForParty, isCottonInteraction, maybeCottonInterjection } from "./cotton.mjs";
import { beginCombatAttack, beginCombatPotion, beginCombatSpell, combatView, isCombatActive, resetWorkshopCombat, resolveCombatRoll, startWorkshopCombat, takeCombatDodge, workshopOptions } from "./combat.mjs";
import { authoredRouteContext } from "./adventure-rules.mjs";
import { inspectPromptPackets, promptInspectorEnabled } from "./prompt-packets.mjs";
import { buildAuthoritativeRecap } from "./story-recaps.mjs";
import { buildHearthboundPlaytestStatus, playtestToolsEnabled } from "./playtest-status.mjs";
import { adventureDefinition } from "./adventure-registry.mjs";
import { appendTurnTrace, captureTurnState, completeTurnTrace, createTurnTrace, listTurnTraces, redactedTurnTraces } from "./turn-traces.mjs";
import { readRunningBuildInfo } from "./build-info.mjs";

const dev = process.argv.includes("--dev");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const build = readRunningBuildInfo({ cwd:resolve(".") });
const db = createDatabase();
let vite;
let runningServer;

async function queueApplicationRestart() {
  if (runningServer) await new Promise((done) => runningServer.close(done));
  const replacement = spawn(process.execPath, ["--env-file-if-exists=.env", "server/index.mjs"], {
    cwd: resolve("."), detached: true, stdio: "ignore", windowsHide: true, env: process.env,
  });
  replacement.unref();
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((done) => setTimeout(done, 250));
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(700) });
      if (response.ok) process.exit(0);
    } catch { /* The replacement is still starting. */ }
  }
  process.exit(1);
}

const json = (response, status, data) => {
  const body = JSON.stringify(data);
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body), "Cache-Control": "no-store" });
  response.end(body);
};
const readJson = async (request) => { const chunks = []; for await (const chunk of request) chunks.push(chunk); return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}; };
const readBuffer = async (request) => { const chunks = []; for await (const chunk of request) chunks.push(chunk); return Buffer.concat(chunks); };
const authenticatedPlayer = (request) => { const authorization = request.headers.authorization || ""; return getPlayerByToken(db, authorization.startsWith("Bearer ") ? authorization.slice(7) : ""); };

function currentTurnState(player, adventure = getActiveAdventure(db, player.partyId)) {
  const dmState = getPartyState(db, player.partyId, "dm") || {};
  const definition = adventureDefinition(adventure);
  const structuredAdventureId = definition?.id || String(adventure?.id || "");
  const worldState = getPartyState(db, player.partyId, `world:${structuredAdventureId}`) || {};
  return captureTurnState({
    dmState, worldState, roomAuthority:authoredRouteContext(adventure?.id, dmState, worldState),
    pendingCheck:getPartyState(db, player.partyId, `pendingCheck:${player.id}`),
    inventory:listInventory(db, player.id), knownLocations:getKnownLocations(db, player.partyId),
  });
}

export async function handleApi(request, response, url) {
  try {
    if (request.method === "POST" && url.pathname === "/api/system/restart") {
      json(response, 202, { ok: true, restarting: true });
      setTimeout(() => void queueApplicationRestart(), 80);
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/health") {
      const ai = await modelRuntimeView();
      return json(response, 200, { ok:true, build, aiConnected:ai.connected, model:ai.model, modelProfile:ai.profile, modelStatus:ai.status, playtestTools:playtestToolsEnabled(), transcriptionConfigured:Boolean(process.env.WHISPER_URL) });
    }
    if (request.method === "GET" && url.pathname === "/api/models") {
      const player = authenticatedPlayer(request);
      if (!player) return json(response, 401, { error:"Choose your character again." });
      return json(response, 200, await modelRuntimeView({ force:true }));
    }
    if (request.method === "POST" && url.pathname === "/api/models/select") {
      const player = authenticatedPlayer(request);
      if (!player) return json(response, 401, { error:"Choose your character again." });
      const body = await readJson(request);
      return json(response, 200, await selectAndLoadModel(body.model));
    }
    if (request.method === "GET" && url.pathname === "/api/debug/prompt-packets") {
      if (!promptInspectorEnabled()) return json(response, 404, { error:"Prompt inspection is disabled." });
      const player = authenticatedPlayer(request);
      if (!player) return json(response, 401, { error:"Choose your character again." });
      return json(response, 200, { packets:inspectPromptPackets({ partyId:player.partyId, playerId:player.id }) });
    }
    if (request.method === "GET" && url.pathname === "/api/lobby") return json(response, 200, buildLobby(db));
    if (request.method === "POST" && url.pathname === "/api/character-suggestion") return json(response, 200, await generateCharacterDetail(await readJson(request)));
    if (request.method === "POST" && url.pathname === "/api/worlds") return json(response, 201, { world: createWorld(db, await readJson(request)) });
    if (request.method === "POST" && url.pathname === "/api/parties") return json(response, 201, { party: createParty(db, await readJson(request)) });
    if (request.method === "POST" && url.pathname === "/api/players") return json(response, 201, { player: createPlayer(db, await readJson(request)) });
    if (request.method === "POST" && /^\/api\/players\/[^/]+\/move$/.test(url.pathname)) {
      const playerId = decodeURIComponent(url.pathname.split("/")[3]);
      const body = await readJson(request);
      const moved = movePlayerToParty(db, playerId, String(body.partyId || ""));
      return moved ? json(response, 200, { player:moved }) : json(response, 400, { error:"That character cannot be moved to the selected group." });
    }
    if (request.method === "DELETE" && url.pathname.startsWith("/api/players/")) {
      const playerId = decodeURIComponent(url.pathname.slice("/api/players/".length));
      return deletePlayer(db, playerId) ? json(response, 200, { ok: true }) : json(response, 404, { error: "That character was not found." });
    }
    if (request.method === "POST" && url.pathname === "/api/login") {
      const body = await readJson(request);
      const session = loginPlayer(db, String(body.playerId || ""));
      return session ? json(response, 200, session) : json(response, 404, { error: "That character was not found." });
    }
    if (request.method === "POST" && url.pathname === "/api/adventures/select") {
      const body = await readJson(request);
      return json(response, 200, { adventure: selectAdventure(db, String(body.partyId || ""), String(body.adventureId || "")) });
    }
    if (request.method === "POST" && url.pathname === "/api/guidance-mode") {
      const player = authenticatedPlayer(request);
      if (!player) return json(response, 401, { error:"Choose your character again." });
      const body = await readJson(request);
      return json(response, 200, { mode:setGuidanceMode(db, player.partyId, body.mode) });
    }
    if (request.method === "GET" && url.pathname === "/api/game") {
      const player = authenticatedPlayer(request);
      if (!player) return json(response, 401, { error: "Choose your character again." });
      const adventure = getActiveAdventure(db, player.partyId);
      const partyInfo = getParty(db, player.partyId);
      const guidanceMode = getGuidanceMode(db, player.partyId);
      let guidance = getPlayerGuidance(db, player.id, player.partyId);
      const pendingCheck = getPartyState(db, player.partyId, `pendingCheck:${player.id}`);
      const events = listVisibleEvents(db, player);
      const knownLocations = getKnownLocations(db, player.partyId);
      const humanParty = listPlayers(db, player.partyId);
      const dmState = getPartyState(db, player.partyId, "dm") || {};
      const structuredAdventureId = adventureDefinition(adventure)?.id || String(adventure?.id || "");
      const worldState = getPartyState(db, player.partyId, `world:${structuredAdventureId}`) || {};
      const roomAuthority = authoredRouteContext(adventure?.id, dmState, worldState);
      // Guided cards are a projection of the current canonical scene, not a
      // historical response artifact. Rebuild them on every view so a card
      // from an earlier room can never survive a location or clue transition.
      if (!pendingCheck && (guidanceMode === "guided" || (guidanceMode === "standard" && guidance.length > 0))) {
        guidance = refreshPlayerGuidance(db, player);
      }
      const ai = await modelRuntimeView();
      return json(response, 200, {
        build,
        world: { id: partyInfo.worldId, name: partyInfo.worldName },
        group: { id: partyInfo.id, name: partyInfo.name },
        campaign: { title: adventure?.title || "Untitled Adventure", chapter: adventure?.chapter || "A new beginning", scene: adventure?.scene || "At the threshold", minLevel: adventure?.minLevel || 1, maxLevel: adventure?.maxLevel || 1 },
        player,
        party: [...humanParty, cottonForParty(db, player.partyId)],
        events,
        knownLocations,
        recap:buildAuthoritativeRecap({ campaign:{ title:adventure?.title, scene:adventure?.scene }, events, knownLocations, party:humanParty, roomAuthority, pendingCheck }),
        playtest:playtestToolsEnabled() ? buildHearthboundPlaytestStatus({ adventure, dmState, worldState, events, pendingCheck, turnTraces:redactedTurnTraces(listTurnTraces(db, player.partyId, adventure?.id, 8)) }) : null,
        spotlight: getPartySpotlight(db, player.partyId),
        pendingCheck,
        combat: combatView(db, player),
        workshop: String(adventure?.id || "").endsWith("combat-workshop") ? { active:true, opponents:workshopOptions(), checklist:["Basic weapon attack and damage","Class resource or signature feature","Cantrip and levelled spell","Saving throw and area effect","Healing or support ability","Taking damage and reaching 0 HP","Rest and resource recovery","Equipment, ammunition and consumable items"] } : null,
        levelUp:getLevelUpOptions(db, player.id),
        guidanceMode,
        guidance,
        ai: { ...ai, promptInspectorEnabled:promptInspectorEnabled() },
        speech: { transcriptionConfigured: Boolean(process.env.WHISPER_URL) },
        art: { imageConfigured: Boolean(process.env.HEARTHBOUND_IMAGE_API_URL) },
      });
    }
    if (request.method === "POST" && (url.pathname === "/api/adventure/restart" || url.pathname === "/api/test/reset-story")) {
      const player = authenticatedPlayer(request);
      if (!player) return json(response, 401, { error: "Choose your character again." });
      return json(response, 200, resetPartyStory(db, player.partyId));
    }
    if (request.method === "POST" && url.pathname === "/api/action") {
      const body = await readJson(request);
      const player = authenticatedPlayer(request);
      if (!player) return json(response, 401, { error: "Your character session has expired." });
      const text = String(body.text || "").trim().slice(0, 1200);
      if (!text) return json(response, 400, { error: "Describe an action first." });
      const mode = ["act", "speak", "ask"].includes(body.mode) ? body.mode : "act";
      const audience = normalizeSpeechAudience(mode, body.audience);
      const combatActive = isCombatActive(db, player.partyId);
      const currentSpotlight = getPartySpotlight(db, player.partyId);
      const partySize = listPlayers(db, player.partyId).length;
      if (!combatActive && !canSubmitOutsideCombat({ mode, audience, partySize, spotlightPlayerId:currentSpotlight.playerId, playerId:player.id })) {
        return json(response, 409, { error:`${currentSpotlight.name} has the spotlight. You can still talk to the party or ask the DM, or take the spotlight if it is your turn.` });
      }
      const adventure = getActiveAdventure(db, player.partyId);
      const trace = createTurnTrace({ adventureId:adventure?.id, playerId:player.id, mode, audience, text, before:currentTurnState(player, adventure), modelProfile:currentModelProfile().id });
      const finishTrace = (result) => {
        const after = currentTurnState(player, adventure);
        const pendingCheck = getPartyState(db, player.partyId, `pendingCheck:${player.id}`);
        const latestNarration = listVisibleEvents(db, player).filter((event) => event.kind === "narration" && event.visibility === "public").at(-1)?.text || "";
        appendTurnTrace(db, player.partyId, adventure?.id, completeTurnTrace(trace, {
          source:result.source, selectedRule:result.rule, after, pendingCheck,
          publicFacts:Array.isArray(result.publicFacts) ? result.publicFacts : [], narration:result.narration || latestNarration, accepted:result.accepted !== false, reason:result.reason,
          diagnostic:result.diagnostic, promptPacketIds:result.promptPacketIds, rejectedProposals:result.rejectedProposals,
        }));
      };
      if (mode === "speak" && audience === "party") {
        addEvent(db, { partyId:player.partyId, visibility:"public", playerId:player.id, kind:"action", speaker:player.name, text:`says quietly to the party: ${text}`, payload:{ audience:"party" } });
        await maybeCottonInterjection(db, player, mode, audience, text);
        finishTrace({ source:"party-conversation", rule:"private-party-speech" });
        return json(response, 200, { ok:true, source:"party-conversation", spotlight:currentSpotlight });
      }
      const prefixes = { act: "attempts", speak: "says aloud", ask: "asks the DM" };
      addEvent(db, { partyId: player.partyId, visibility: "public", playerId: player.id, kind: "action", speaker: player.name, text: `${prefixes[mode]}: ${text}` });
      if (mode !== "ask" && isCottonInteraction(text)) {
        await maybeCottonInterjection(db, player, mode, audience, text);
        const spotlight = combatActive ? getPartySpotlight(db, player.partyId) : advancePartySpotlight(db, player.partyId, player.id);
        finishTrace({ source:"cotton", rule:"companion-interaction" });
        return json(response, 200, { ok:true, source:"cotton", spotlight });
      }
      const result = await resolveAction(db, player, mode, text);
      if (mode !== "ask") await maybeCottonInterjection(db, player, mode, audience, text);
      const spotlight = !actionUsesSpotlight(mode, audience) || combatActive ? getPartySpotlight(db, player.partyId) : advancePartySpotlight(db, player.partyId, player.id);
      finishTrace(result);
      return json(response, 200, { ok: true, source: result.source, spotlight });
    }
    if (request.method === "POST" && url.pathname === "/api/combat/attack") {
      const body = await readJson(request);
      const player = authenticatedPlayer(request);
      if (!player) return json(response, 401, { error:"Choose your character again." });
      const combat = beginCombatAttack(db, player, String(body.weaponName || ""));
      return combat ? json(response, 200, { ok:true }) : json(response, 409, { error:"Combat is not active." });
    }
    if (request.method === "POST" && url.pathname === "/api/combat/spell") {
      const body = await readJson(request);
      const player = authenticatedPlayer(request);
      if (!player) return json(response, 401, { error:"Choose your character again." });
      const combat = beginCombatSpell(db, player, String(body.spellName || ""));
      return combat ? json(response, 200, { ok:true }) : json(response, 409, { error:"That spell is not available, prepared, or has no remaining spell slot." });
    }
    if (request.method === "POST" && url.pathname === "/api/combat/potion") {
      const player = authenticatedPlayer(request);
      if (!player) return json(response, 401, { error:"Choose your character again." });
      const combat = beginCombatPotion(db, player);
      return combat ? json(response, 200, { ok:true }) : json(response, 409, { error:"A Potion of Healing is not available as a Bonus Action right now." });
    }
    if (request.method === "POST" && url.pathname === "/api/workshop/start") {
      const body = await readJson(request);
      const player = authenticatedPlayer(request);
      if (!player) return json(response, 401, { error:"Choose your character again." });
      const adventure = getActiveAdventure(db, player.partyId);
      if (!String(adventure?.id || "").endsWith("combat-workshop")) return json(response, 409, { error:"Select the Combat Workshop first." });
      startWorkshopCombat(db, player, String(body.opponentId || "training-dummy"), body.participantMode === "party" ? "party" : "solo");
      return json(response, 200, { ok:true });
    }
    if (request.method === "POST" && url.pathname === "/api/workshop/reset") {
      const player = authenticatedPlayer(request);
      if (!player) return json(response, 401, { error:"Choose your character again." });
      const adventure = getActiveAdventure(db, player.partyId);
      if (!String(adventure?.id || "").endsWith("combat-workshop")) return json(response, 409, { error:"Select the Combat Workshop first." });
      return json(response, 200, resetWorkshopCombat(db, player));
    }
    if (request.method === "POST" && url.pathname === "/api/workshop/level-up") {
      const player = authenticatedPlayer(request);
      if (!player) return json(response, 401, { error:"Choose your character again." });
      return json(response, 200, { player:levelUpPlayer(db, player.id, await readJson(request)) });
    }
    if (request.method === "POST" && url.pathname === "/api/combat/dodge") {
      const player = authenticatedPlayer(request);
      if (!player) return json(response, 401, { error:"Choose your character again." });
      const result = takeCombatDodge(db, player);
      return result ? json(response, 200, { ok:true }) : json(response, 409, { error:"Combat is not active." });
    }
    if (request.method === "POST" && url.pathname === "/api/spotlight/pass") {
      const player = authenticatedPlayer(request);
      if (!player) return json(response, 401, { error: "Your character session has expired." });
      if (isCombatActive(db, player.partyId)) return json(response, 409, { error:"Combat turn order controls the spotlight." });
      return json(response, 200, { spotlight: advancePartySpotlight(db, player.partyId, player.id) });
    }
    if (request.method === "POST" && url.pathname === "/api/spotlight/take") {
      const player = authenticatedPlayer(request);
      if (!player) return json(response, 401, { error:"Your character session has expired." });
      if (isCombatActive(db, player.partyId)) return json(response, 409, { error:"Combat initiative controls the turn." });
      return json(response, 200, { spotlight:setPartySpotlight(db, player.partyId, player.id) });
    }
    if (request.method === "POST" && url.pathname === "/api/roll") {
      const body = await readJson(request);
      const player = authenticatedPlayer(request);
      if (!player) return json(response, 401, { error: "Your character session has expired." });
      const sides = Number(body.sides);
      if (![4, 6, 8, 10, 12, 20, 100].includes(sides)) return json(response, 400, { error: "That die is not available." });
      const pendingBeforeRoll = sides === 20 ? getPartyState(db, player.partyId, `pendingCheck:${player.id}`) : null;
      const adventure = pendingBeforeRoll ? getActiveAdventure(db, player.partyId) : null;
      const trace = pendingBeforeRoll ? createTurnTrace({ adventureId:adventure?.id, playerId:player.id, mode:"act", audience:"nearby", text:`resolve ${pendingBeforeRoll.ability} (${pendingBeforeRoll.skill}) check`, before:currentTurnState(player, adventure), modelProfile:currentModelProfile().id }) : null;
      const result = Math.floor(Math.random() * sides) + 1;
      const combatRoll = resolveCombatRoll(db, player, sides, result);
      const check = combatRoll ? null : sides === 20 ? await resolvePendingCheck(db, player, result) : null;
      if (trace && check) appendTurnTrace(db, player.partyId, adventure?.id, completeTurnTrace(trace, {
        source:check.source, selectedRule:check.rule, after:currentTurnState(player, adventure), publicFacts:check.publicFacts, narration:check.narration || "",
        accepted:true, diagnostic:check.diagnostic, promptPacketIds:check.promptPacketIds, rejectedProposals:check.rejectedProposals,
      }));
      if (!check && !combatRoll) addEvent(db, { partyId: player.partyId, visibility: "public", playerId: player.id, kind: "roll", speaker: "Dice", text: `${player.name} rolled d${sides}: ${result}`, payload: { sides, result } });
      return json(response, 200, { sides, result, check, combatRoll });
    }
    if (request.method === "POST" && url.pathname === "/api/transcribe") {
      if (!process.env.WHISPER_URL) return json(response, 503, { error: "Push-to-talk recording works, but local transcription has not been configured on the PC yet." });
      const audio = await readBuffer(request);
      const form = new FormData();
      form.append("file", new Blob([audio], { type: request.headers["content-type"] || "audio/mp4" }), "speech.m4a");
      form.append("model", process.env.WHISPER_MODEL || "whisper-1");
      const transcription = await fetch(process.env.WHISPER_URL, { method: "POST", body: form, signal: AbortSignal.timeout(45000) });
      const result = await transcription.json();
      return transcription.ok ? json(response, 200, { text: result.text || "" }) : json(response, 502, { error: result.error?.message || "Local transcription failed." });
    }
    if (request.method === "POST" && url.pathname === "/api/scene-image") {
      const player = authenticatedPlayer(request);
      if (!player) return json(response, 401, { error:"Choose your character again." });
      if (!process.env.HEARTHBOUND_IMAGE_API_URL) return json(response, 503, { error:"Scene pictures need a local image generator configured on the PC first." });
      const adventure = getActiveAdventure(db, player.partyId);
      const dmState = getPartyState(db, player.partyId, "dm") || {};
      const definition = adventureDefinition(adventure);
      const worldState = getPartyState(db, player.partyId, `world:${definition?.id || String(adventure?.id || "")}`) || {};
      const route = authoredRouteContext(adventure?.id, dmState, worldState);
      const known = getKnownLocations(db, player.partyId).at(-1);
      const room = route?.currentLocation || (known ? { name:known.name, features:[] } : null);
      const recent = listVisibleEvents(db, player).filter((event)=>event.kind==="narration" && event.visibility==="public").slice(-3).map((event)=>event.text).join(" ");
      const prompt = [
        "Painterly cinematic fantasy scene, grounded 2024 tabletop adventure, dark warm candlelight, aged stone and wood, restrained gold and teal palette, readable spatial composition, no interface.",
        `Adventure: ${adventure?.title || "Hearthbound"}. Current room only: ${room?.name || adventure?.scene || "the established location"}.`,
        room?.features?.length ? `Visible features only: ${room.features.join(", ")}.` : "Show only already established visible features.",
        recent ? `Current public scene: ${recent}` : "",
        "Do not show secret doors, unseen rooms, unrevealed creatures, future clues, text, labels, borders, UI, watermark, or map symbols.",
      ].filter(Boolean).join(" ");
      const generated = await fetch(process.env.HEARTHBOUND_IMAGE_API_URL, {
        method:"POST", headers:{"Content-Type":"application/json"}, signal:AbortSignal.timeout(120000),
        body:JSON.stringify({ prompt, negative_prompt:"text, letters, watermark, logo, user interface, map, diagram, secret room, hidden door, spoiler, modern objects", steps:20, width:768, height:512, cfg_scale:6, sampler_name:"DPM++ 2M Karras" }),
      });
      const result = await generated.json();
      const encoded = result.images?.[0] || result.image;
      if (!generated.ok || !encoded) return json(response, 502, { error:result.error || result.detail || "The local image generator did not return a picture." });
      return json(response, 200, { image:String(encoded).startsWith("data:") ? encoded : `data:image/png;base64,${encoded}`, caption:room?.name || adventure?.scene || "Current scene" });
    }
    return json(response, 404, { error: "Not found." });
  } catch (error) {
    console.error(error);
    return json(response, 500, { error: error instanceof Error ? error.message : "The campaign server encountered an error." });
  }
}

const mimeTypes = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml" };
export async function start() {
  if (dev) { const { createServer: createViteServer } = await import("vite"); vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" }); }
  const requestHandler = async (request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) return handleApi(request, response, url);
    if (vite) return vite.middlewares(request, response, () => json(response, 404, { error: "Not found." }));
    const dist = resolve("dist");
    let filename = join(dist, decodeURIComponent(url.pathname) === "/" ? "index.html" : decodeURIComponent(url.pathname));
    if (!filename.startsWith(dist) || !existsSync(filename) || statSync(filename).isDirectory()) filename = join(dist, "index.html");
    response.writeHead(200, { "Content-Type": mimeTypes[extname(filename)] || "application/octet-stream" });
    response.end(readFileSync(filename));
  };
  const secure = Boolean(process.env.HTTPS_KEY && process.env.HTTPS_CERT);
  const server = secure ? createHttpsServer({ key: readFileSync(resolve(process.env.HTTPS_KEY)), cert: readFileSync(resolve(process.env.HTTPS_CERT)) }, requestHandler) : createHttpServer(requestHandler);
  runningServer = server;
  server.listen(port, host, () => console.log(`Hearthbound is ready at ${secure ? "https" : "http"}://localhost:${port}`));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) start();
