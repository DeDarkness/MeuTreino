import raw from "./elite-catalog.txt?raw";
import { parseEliteCatalog } from "./engine";
export const ELITE_FOODS = parseEliteCatalog(raw);
