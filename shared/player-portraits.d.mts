export interface PlayerPortrait {
  readonly id: string; readonly label: string; readonly species: string; readonly gender: string;
  readonly legacy: boolean; readonly file: string; readonly size: string; readonly position: string;
}
export declare const PORTRAIT_SPECIES: readonly string[];
export declare const PLAYER_PORTRAITS: readonly PlayerPortrait[];
export declare function playerPortrait(id: string): PlayerPortrait | undefined;
export declare function portraitsFor(species: string, gender?: string): PlayerPortrait[];
export declare function portraitSelection(species: string, gender?: string, preferred?: string): string;
export declare function acceptedPlayerPortrait(id: unknown, species: string): string;
export declare function playerPortraitStyle(id: string): {backgroundImage: string; backgroundSize: string; backgroundPosition: string} | undefined;
