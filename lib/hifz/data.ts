import raw from "../../public/data/mushaf.json";
import { loadMushaf, type MushafData } from "./mushaf";

export const mushaf: MushafData = loadMushaf(raw as MushafData);
