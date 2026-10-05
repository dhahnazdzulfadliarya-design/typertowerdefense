export const DEBUG_ARCHER = false;
export const HEARTS = 5;
export const STAGES = ['ready', 'nock', 'draw', 'aim', 'release', 'reset'];
export const ASSETS = {forest:'assets/forest.webp', tower:'assets/tower.webp', archer:'assets/archer-8dir.webp', monsters:'assets/monsters.webp', hero:'assets/landing-hero.webp'};
// Every original name is retained, grouped by actual length.
export const NAME_POOLS = {
  short: 'Azhur Ghorv Azrak Borun Davor Gorak Kavor Morak Ruzak Torva Varek Zorak Brakka Cyrath Drazul Havrix Izzara Lurvax Ozmira Rhexul Azrath Ghorak Kharun Morvex Razhul Varnok Zorath'.toUpperCase().split(' '),
  medium: 'Jorveth Morkhal Nythora Qiravox Skarven Ulvaryn Vorthak Wyrmoth Zhaemir Azravel Drazeth Ghorven Kharvox Rhexora Varneth Eshkaryn Fenthrix Klyndora Thalorix Xylarune Azrakhor Brakkorn Cyraveth Drazukar Havrynth Izzareth Lurvakar Skarveth Vorthrax Zhaemora'.toUpperCase().split(' '),
  long: 'Azhurkaryn Ghorvathrix Brakkavorth Cyrathmorth Drazulthorn Havrixshade Izzaravayne Lurvaxdrath Jorvethkhal Morkhalvex Nythoraveth Qiravoxryn Skarvenoth Ulvarynhex Zhaemirvox'.toUpperCase().split(' ')
};
export const MONSTER_WIDTHS=[92,104,72,70];
export const MONSTER_LABEL_HEIGHTS=[76,65,91,58];
export const clamp=(n,low,high)=>Math.max(low,Math.min(high,n));
