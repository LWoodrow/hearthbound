# Species portrait catalogue

2026-10-04: imagegen skill, built-in tool mode. Nine original two-cell sprite sheets; male left, female right. Assets inspected for species traits, framing and lack of text; all are 1774 × 887, exactly two square cells. Existing eight-cell art retained unchanged (seven Humans, one Elf). Catalogue and CSS share stable IDs/crops. No generation during play. Gender is a portrait filter, not a rules bonus or a restriction on character identity.

Assets are `public/art/portraits/player-{aasimar,dragonborn,dwarf,elf,gnome,goliath,halfling,orc,tiefling}-v1.png`. Originals retained in the Codex generated-images folder.

## Exact prompt template

Use case: stylized-concept. Asset type: two-cell species portrait sprite sheet for a fantasy RPG character creator. Primary request: exactly TWO separate detailed head-and-shoulders portraits, adult MALE in the LEFT half and adult FEMALE in the RIGHT half. Composition: wide 2:1 canvas made of two equal square cells, each face centered within its own half; head/horns/ears fully visible with comfortable padding, eyes level, shoulders clothed in practical layered fantasy adventuring clothes. Style: premium hand-painted realistic fantasy game portrait, rich fine brushwork, textured skin and fabric, natural soft dramatic lighting, dark muted painterly background, no cartoon. Both portraits same scale; independent backgrounds reach each cell edge, NO divider or border or gaps. Portraits must remain clearly readable in small square avatars and attractive enlarged. Constraints: original characters, no text, letters, labels, numbers, UI, watermarks, logos, hands, weapons, nudity, or duplicate heads.

Each call appends `Species: NAME. Subject details: DETAILS.` using the following exact values:

- **Aasimar**: celestial humanoids, luminous gold eyes, subtle radiant skin markings, no wings occupying portrait; male warm brown skin short silver curls, female deep brown skin silver braids.
- **Dragonborn**: unmistakably draconic humanoids, scaled faces, elongated dragon snouts, no human hair or human skin; male bronze scales broad horn ridges, female teal scales elegant curved horns.
- **Dwarf**: stout adult dwarves, broad noses, heavy sturdy shoulders; male braided auburn beard, female dark braided hair and strong weathered face.
- **Elf**: adult slender elves with visibly long pointed ears; male copper skin black swept-back hair, female brown skin long silver hair.
- **Gnome**: adult gnomes, prominent noses, lively mature faces, pointed ears, compact proportions; male sandy beard and goggles on forehead, female short silver curls and curious expression.
- **Goliath**: adult giant-descended humanoids, immense muscular shoulders, grey stone-toned skin, dark natural geometric markings; male bald strong face, female dark braided hair powerful face.
- **Halfling**: adult halflings, compact rounded proportions and friendly mature faces, softly pointed ears; male curly brown hair sideburns, female chestnut curls freckles; unmistakably adults not children.
- **Orc**: adult orcs, green-grey skin, visible lower tusks, broad noses, powerful shoulders; male dark short hair, female long dark braid, both dignified.
- **Tiefling**: adult tieflings, visible curved horns, pointed ears and unusual jewel-coloured skin; male dusky red skin black hair and gold eyes, female violet skin white hair and amber eyes.

## Original-style variety expansion

Final review: four distinct cells per sheet with different palette/age/dress. One rejected intermediate Tiefling sheet omitted the pale female's horns; an explicit bottom-right-only edit corrected this before handoff. Exact correction prompt follows; other three characters and the cell geometry are locked. Art review does not substitute for human preference/browser review.

### Exact Tiefling correction prompt

undefined

2026-10-04 follow-up: nine additional original four-cell sheets, two male cells across the top and two female cells across the bottom. These ADD choices rather than replace any saved portrait. The original atlas is the sole style reference: `public/art/portraits/player-portraits-v1.png`. Built-in imagegen, one call per species. New asset template: `public/art/portraits/player-SPECIES-variety-v2.png` (lowercase species). At least three choices per gender for every species, with the original elf retained as a fourth female Elf option. Inspiration labels are cosmetic, not classes.

### Visual diagnosis

The original elf's cobalt background, pale-hair contrast, blue gemstones, delicate ear silhouette and individually authored clothing make it more distinctive than the first new pair. That pair's generic dark background, repeated practical costume/brooch and similar faces came from overly uniform prompt constraints, not a rendering or resolution defect. The expansion explicitly requests painted rather than photographic character design, independent faces, ages, expressions, ornamental clothing and strongly varied coloured backgrounds. Quality is ultimately a human art-review choice.

### Exact shared prompt

Use case: stylized-concept. Asset type: four-cell portrait sprite sheet for Hearthbound character creation. Input image 1 is STYLE REFERENCE ONLY: the existing player atlas, especially the white-haired female elf in its top row third cell. Do not alter or reproduce that image. Create FOUR entirely new distinctive adult adventurers of the specified species. Square canvas, exact 2 by 2 grid of four equal square cells; first male TOP LEFT, second male TOP RIGHT, first female BOTTOM LEFT, second female BOTTOM RIGHT. One head and upper shoulders centered in each cell. Style: match the reference's sophisticated painted fantasy illustration, delicate fine brushwork, elegant facial modelling and characterful eye expressions, detailed ornamental clothing and individually appropriate jewellery, vivid textured coloured backdrops with clearly differing hues per cell, strong subject-background contrast. NOT photographic headshots, NOT a brown-grey studio set. Faces must look like four unrelated individuals of different ages, features and personalities, not siblings. Vary subtle three-quarter angles and expressions while keeping eyes legible in tiny avatars. All hair, ears and horns within each cell; enough margin, no cross-cell overlap. No shared uniform, repeated scarf or repeated medallion. Original fantasy art; no text, labels, numbering, frame, gutters, watermarks, UI, modern clothing, weapons, full bodies or extra characters. For non-human species, strong recognizable ancestry morphology in every cell.

Each call appends the following exact species and positional brief. The gender/label metadata below is saved in the finite catalogue; the cell positions are fixed.

#### Aasimar

Asset: `public/art/portraits/player-aasimar-variety-v2.png`

Species: Aasimar.
Top left: young adult celestial man with copper skin, tousled tawny hair, faint gold luminous eyes, engraved ivory-and-brass armour, thoughtful steady expression; painterly warm sunrise gold background.
Top right: older adult celestial man with dark brown skin, silver beard, subtle silver celestial facial markings, embroidered midnight blue high-collar robes, kind knowing smile; painterly violet star-haze background.
Bottom left: adult celestial woman with olive skin, auburn loose braid, faint luminous eyes, white-and-saffron woven mantle, gentle smiling expression; painterly terracotta and apricot background.
Bottom right: adult celestial woman with deep umber skin, short pale silver hair, delicate silver circlet and pearl clasps, indigo gown with protective shoulder mantle, poised expression; bright painterly cobalt blue background.

#### Dragonborn

Asset: `public/art/portraits/player-dragonborn-variety-v2.png`

Species: Dragonborn.
Top left: older adult dragonborn man, deep red scales, weathered long reptilian snout, chipped swept-back horns, engraved dark iron armour, resolute expression; painterly rust-red ember background.
Top right: adult dragonborn man, sapphire blue scales, slim dragon muzzle, fine horn ridges, elaborate violet scholar robes and small silver collar jewels, curious expression; painterly rich violet background.
Bottom left: adult dragonborn woman, pearlescent pale scales, clearly draconic long muzzle and elegant horns, sapphire-and-silver woven ceremonial mantle, calm expression; painterly bright cobalt background.
Bottom right: adult dragonborn woman, jade green scales, strong dragon snout and short crown-like horns, burgundy practical leather coat and ochre scarf, lively expression; painterly gold forest background.

#### Dwarf

Asset: `public/art/portraits/player-dwarf-variety-v2.png`

Species: Dwarf.
Top left: older adult dwarf man, broad rugged face, slate-grey braided beard with copper rings, heavy engraved steel armour, stern but warm eyes; painterly rust-red background.
Top right: adult dwarf man, brown skin, black curly beard and bushy brows, turquoise embroidered robe, single round brass monocle, wry smile; painterly rich cobalt blue background.
Bottom left: adult dwarf woman, warm brown skin, red braided hair, broad sturdy face and muscular shoulders, ornate bronze armour, confident expression; painterly warm ochre-gold background.
Bottom right: older adult dwarf woman, pale freckled skin, silver hair braided into a crown, plum wool robes and carved amber necklace, amused expressive face; painterly violet background.

#### Elf

Asset: `public/art/portraits/player-elf-variety-v2.png`

Species: Elf.
Top left: adult male woodland elf, long visible slender pointed ears, tawny freckled skin, copper red braided hair, moss-green leather mantle with leaf motifs, soft mischievous half-smile; saturated painterly green forest background.
Top right: older adult male high elf, slender angular face and long pointed ears, light olive skin, flowing silver hair, richly embroidered violet-blue robes and a fine sapphire brow jewel, thoughtful expression; saturated luminous cobalt blue background.
Bottom left: adult female high elf, long delicate pointed ears, honey-brown skin, golden hair with fine braids and amber jewels, ivory-and-gold embroidered mantle, composed regal gaze; rich painterly amber-gold background.
Bottom right: adult female elf, long clear pointed ears, dark umber skin, short wavy black hair, burgundy cloak and delicate silver ear jewellery, spirited slight smile; saturated painterly plum-violet background.

#### Gnome

Asset: `public/art/portraits/player-gnome-variety-v2.png`

Species: Gnome.
Top left: adult gnome man, compact mature face, prominent nose and pointed ears, unruly red hair and short beard, rust leather vest and small brass goggles on forehead, delighted thoughtful grin; painterly bright copper-gold background.
Top right: older adult gnome man, dark brown skin, white curled moustache, pointed ears, midnight blue embroidered robe, small round spectacles, thoughtful expression; rich painterly cobalt-blue background.
Bottom left: adult gnome woman, tan freckled mature face, prominent nose and pointed ears, dark curly hair with tiny flowers, green woven tunic, cheerful knowing smile; painterly saturated forest-green background.
Bottom right: older adult gnome woman, softly lined mature face, violet-grey pixie haircut, pointed ears and prominent nose, plum velvet jacket and amber pendant, curious expression; painterly warm violet background.

#### Goliath

Asset: `public/art/portraits/player-goliath-variety-v2.png`

Species: Goliath.
Top left: older adult giant-descended goliath man, broad craggy face, huge muscular shoulders, dark slate skin and pale geometric natural markings, shaved head and short grey beard, storm-blue fur-lined mantle; painterly deep cobalt-blue background.
Top right: adult giant-descended goliath man, pale grey stone-toned skin and dark geometric facial markings, cropped auburn hair, muscular shoulders in reddish leather armour, friendly half-smile; painterly vivid ochre-gold background.
Bottom left: adult giant-descended goliath woman, immense powerful shoulders, light stone skin with dark geometric markings, silver hair in heavy braid, engraved steel armour over blue wool, confident gaze; painterly icy teal background.
Bottom right: older adult giant-descended goliath woman, charcoal stone-toned skin with pale natural markings, short greying curls, powerful broad face and shoulders, burgundy woven cloak, kind expressive eyes; painterly plum-purple background.

#### Halfling

Asset: `public/art/portraits/player-halfling-variety-v2.png`

Species: Halfling.
Top left: adult halfling man, rounded mature face, small softly pointed ears, chestnut curls and sideburns, colourful burgundy waistcoat and ochre shirt, playful knowing smile; painterly warm golden background.
Top right: older adult halfling man, dark brown skin, silver curls and moustache, small pointed ears, indigo scholarly coat and tiny round spectacles, kind lined face; painterly rich cobalt-blue background.
Bottom left: adult halfling woman, rounded adult face, tan freckles, small pointed ears, auburn curly bob, green travel vest and flower-patterned scarf, bright confident grin; painterly forest-green background.
Bottom right: older adult halfling woman, warm brown skin, black hair with silver streaks in braided updo, small pointed ears, plum embroidered jacket and amber earrings, shrewd playful eyes; painterly rust-red background.

#### Orc

Asset: `public/art/portraits/player-orc-variety-v2.png`

Species: Orc.
Top left: older adult orc man, rugged green-grey skin, strong nose and clearly visible lower tusks, white beard and cropped white hair, weathered dark steel armour, thoughtful dignified eyes; painterly rich rusty red background.
Top right: adult orc man, moss-green skin, lower tusks and broad nose, long black hair tied back, cobalt scholar robes and carved bone clasp, gentle curious expression; painterly blue-violet background.
Bottom left: adult orc woman, olive-green skin, visible tusks and broad powerful face, auburn undercut braid, amber leather armour, confident half-smile; painterly vivid ochre-gold background.
Bottom right: older adult orc woman, dark green-grey skin, mature lined face with lower tusks, silver curly hair, green-and-plum woven robe and copper leaf earrings, amused expressive eyes; painterly saturated forest-green background.

#### Tiefling

Asset: `public/art/portraits/player-tiefling-variety-v2.png`

Species: Tiefling.
Top left: adult tiefling man, dusky red skin, distinct ridged curved horns, pointed ears, white swept-back hair, black-and-burgundy tailored coat, confident mischievous expression; painterly red-gold background.
Top right: older adult tiefling man, deep blue skin, long curved horns, silver beard and long dark hair, elaborate violet robes with silver embroidery, kind knowing eyes; painterly rich violet background.
Bottom left: adult tiefling woman, warm copper-orange skin, graceful black curved horns and pointed ears, short wavy black hair, forest-green leather mantle, lively half-smile; painterly gold background.
Bottom right: adult tiefling woman, pale lavender skin, elegant swept-back horns, white hair with fine braids, delicate sapphire jewellery and blue velvet embroidery, poised distinctive face; saturated bright painterly cobalt background.
