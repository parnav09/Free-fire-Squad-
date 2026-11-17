export const petHinglish: Record<string, { summary: string; effects: string[]; mechanics: string[] }> = {
"agent-hop":{summary:"Safe Zone chhoti hone par 50 EP wapas deta hai.",effects:["Safe Zone shrink hote hi owner ko 50 EP milta hai.","Player map par kahin bhi ho, supplied report ke mutabik skill chaalu hona hone ki condition ho sakti hai."],mechanics:["EP ek extra recovery bar ki tarah kaam karta hai. Ye pet bina manually chaalu hona kiye EP generate karta hai.","Report ke estimate ke mutabik ek normal Battle Royale match mein total 250 EP tak mil sakta hai. Ye estimate hai, guaranteed value nahi."]},
"agumon":{summary:"Sirf cosmetic companion hai; gameplay skill nahi deta.",effects:["Agumon ke paas combat, EP/HP recovery ya movement se judi koi gameplay ability nahi hai."],mechanics:["Supplied report Agumon ko Digimon collaboration ka pet batati hai.","Is profile mein koi gameplay skill ya combat modifier assign nahi hai."]},
"arvon":{summary:"50m ke area mein kitne enemies hain, ye detect karta hai.",effects:["Radar pulse bhejkar 50m ke area mein enemies ki ginti 6 seconds tak detect karta hai.","Supplied report ke mutabik enemy count sabhi alive teammates ko turant share hota hai."],mechanics:["Report ke mutabik detection walls aur terrain ke paar bhi kaam karta hai, chahe enemy upar ya neeche ho.","Ye sirf enemies ki ginti batata hai; unki exact location location pata karta nahi karta.","OB41 mein mini-map se chaalu hona karne ka option aane ki baat report mein hai; is detail ki source verification pending hai."]},
"beaston":{summary:"phenka ki jaane wali cheezon ki distance 30% badhata hai.",effects:["Grenade aur doosri throwable items 30% zyada door tak jaati hain."],mechanics:["Skill throwable ke jaane ka angle/raasta aur uski placement distance badalti hai.","Supplied report mein Grenade, Gloo Wall aur Flash Freeze ka naam diya gaya hai."]},
"detective-panda":{summary:"Elimination lene ke baad 10 HP wapas deta hai.",effects:["Enemy ko eliminate karne ke turant baad owner ko 10 HP milta hai."],mechanics:["Ye successful elimination ke baad milne wala chhota instant HP recovery bonus hai.","Report ka 200 HP ke comparison wala example sirf samjhane ke liye hai; ye pet ki alag stat nahi."]},
"dr-beanie":{summary:"Crouch karke move karne par movement speed 60% badhata hai.",effects:["Crouch position mein chalte waqt owner ki movement speed 60% badh jaati hai."],mechanics:["Skill tabhi active hoti hai jab player crouch karke move kar raha ho.","Extra kitni door tak, kitni der tak, restriction ya kisi doosri skill ke saath kisi cheez ko use karne ka action ki detail supplied report mein nahi thi."]},
"dreki":{summary:"Structures ke peeche recovery kar rahe opponents ko location dikha deta karta hai.",effects:["Jo opponent kisi structure ke peeche recovery kar raha ho, Dreki use location dikha deta karta hai."],mechanics:["Detection ka exact radius aur location dikha deta kitni der rehta hai, iska verified value supplied report mein nahi diya gaya.","Unlockable names/levels report mein nahi the, isliye koi naam ya level add nahi kiya gaya."]},
"falco":{summary:"Parachute phase mein enemy ka auto-aim owner par kaam nahi karta.",effects:["Parachute se utarte waqt enemy ka auto-aim owner ko automatically aim kiya hua nahi kar pata."],mechanics:["Ye effect sirf parachute phase tak limited hai.","Landing ke baad ka effect, alag kitni door tak ya kitni der tak supplied report mein nahi diya gaya."]},
"fang":{summary:"Teammate knock hone par 30 EP ya 15 HP deta hai.",effects:["Teammate knock hote hi owner ko 30 EP ya 15 HP milta hai."],mechanics:["Recovery ke do possible values report mein diye gaye hain: 30 EP ya 15 HP.","Is skill ka cooldown 25 seconds hai."]},
"finn":{summary:"Survival-focused utility hai; exact numerical skill values supplied data mein nahi hain.",effects:["Supplied report Finn ko survival-focused utility wala pet batati hai, lekin exact number ya percentage effect nahi deti."],mechanics:["Report ke mutabik iska focus player ki position aur match mein survive karne se judi utility par hai.","Exact values, cooldown chaalu hona hone ki condition aur percentage buff nahi diye gaye; game-client data milne tak ye details blank rahengi."]},
"flash":{summary:"Peeche se aane wale damage ko 25% kam karta hai.",effects:["Owner par peeche ki taraf se attack hone par damage 25% kam hota hai."],mechanics:["Report ke mutabik damage reduction ki maximum limit 150 armor ki majbooti points hai.","Report mein ye protection peeche se aane wale ballistic firearms aur tactical knives ke attacks ke liye batayi gayi hai."]},
"hoot":{summary:"Scanning skills ka area aur location dikha deta time badhata hai.",effects:["Scanning skill ka radius 10m badhta hai aur scan feed 2.5 seconds zyada der tak dikhti hai."],mechanics:["Supplied report ke mutabik Clu ki scanning ability aur UAV scan ke saath kaam karta hai.","Scan se mili information teammates ke saath share hoti hai."]},
"kactus":{summary:"Owner 6 seconds tak ek jagah ruka rahe to har second 10 EP deta hai.",effects:["Owner 6 seconds tak bina hile rahe, uske baad har second 10 EP wapas deta hota hai."],mechanics:["Player move ya jump kare to EP milna band ho jaata hai.","EP 100 tak pahunchne par recovery ruk jaati hai."]},
"kitty":{summary:"Sirf cosmetic companion hai; gameplay ability nahi hai.",effects:["Kitty gameplay mein koi skill ya combat advantage nahi deti."],mechanics:["Supplied report ke mutabik Kitty ke paas tactical skill, gameplay algorithm ya stat modifier nahi hai.","Gatito isi pet ka alias/backend naam hai; ye alag pet profile nahi hai."]},
"mechanical-pup":{summary:"Sirf cosmetic companion hai; combat ya utility skill nahi hai.",effects:["Mechanical Pup koi combat skill ya gameplay utility nahi deta."],mechanics:["Supplied report ke mutabik is pet ke paas combat script ya gameplay utility nahi hai."]},
"moony":{summary:"kisi cheez ko use karne ka action animation ke dauran milne wala damage 35% kam karta hai.",effects:["Owner jab kisi cheez ko use karne ka action animation kar raha hota hai, tab aane wala damage 35% kam hota hai."],mechanics:["Protection sirf kisi cheez ko use karne ka action animation ke dauran milti hai.","Alag kitni door tak ya extra kitni der tak ka value supplied report mein nahi tha."]},
"mr-waggor":{summary:"Inventory mein 2 se kam Gloo Wall ho to ek Gloo Wall generate karta hai.",effects:["Owner ke paas 2 se kam Gloo Wall bachi ho, to pet ek Gloo Wall generate karta hai."],mechanics:["Supplied report ke mutabik har 100 seconds mein Gloo Wall generate karne ka automatic cycle hai.","Report mein pehle 200 seconds ke andar 200 Gloo Maker EXP bhi diya gaya hai. Ye supplied value hai aur verification pending hai."]},
"night-panther":{summary:"Inventory mein 45 extra slots deta hai.",effects:["Owner ki inventory capacity 45 slots badh jaati hai."],mechanics:["Is pet ka main effect inventory mein zyada items rakh paana hai.","Alag chaalu hona hona chaalu hona hone ki condition ya kitni der tak supplied report mein nahi diya gaya."]},
"ottero":{summary:"Heal hue HP ka 65% EP mein convert karta hai.",effects:["Jitna HP heal hota hai, uska 65% EP mein convert ho jaata hai."],mechanics:["EP recovery, HP heal hone ke saath linked hai.","Koi extra cap ya alag chaalu hona hona delay supplied report mein nahi diya gaya."]},
"poring":{summary:"Armor repair karta hai aur high-tier armor ko destroy hone se bachata hai.",effects:["Armor ki armor ki majbooti repair karta hai aur high-tier armor ko completely break hone se bachata hai."],mechanics:["Is pet ke main effects armor repair aur high-tier armor protection hain.","Kitna armor repair hota hai, kitne interval par hota hai aur unlockable names kya hain—ye details available report mein nahi thi; isliye guess nahi kiya."]},
"pug":{summary:"Cosmetic companion hai; gameplay ability nahi deta.",effects:["Pug sirf appearance ke liye hai aur gameplay mein koi skill nahi deta."],mechanics:["Supplied report ke mutabik Pug ka combat ya economy system se related koi effect nahi hai."]},
"robo":{summary:"Deploy ki gayi Gloo Wall ko 100 extra HP deta hai.",effects:["Deploy hone ke baad Gloo Wall ko 100 extra HP ki shield milti hai."],mechanics:["Supplied report is effect ko Gloo Wall par add hone wali 100 HP ki extra layer batati hai."]},
"rockie":{summary:"Equipped active skill ka cooldown 15% kam karta hai.",effects:["Equipped active skill dobara use karne ke liye jo wait time hota hai, woh 15% kam ho jaata hai."],mechanics:["Supplied report ke mutabik active skill ke cooldown mein 15% ki kami aati hai."]},
"sensei-tig":{summary:"Enemy ki marking skills ka effect rehne ka time kam karta hai.",effects:["Enemy ki marking skill tumhe mark kare, to us mark ka effect kam time tak rehta hai."],mechanics:["Report ke mutabik Moco/Shirou jaise enemy ki location follow karna markers par iska effect padta hai.","Report mein purane 30%–40% reduction values ka zikr hai, lekin OB39 ka final combined maximum nahi diya gaya. Isliye ek current percentage assume nahi kiya."]},
"shiba":{summary:"Map par aas-paas ke mushrooms ko mark karta hai.",effects:["Mini-map par aas-paas ke mushrooms ki location mark karta hai."],mechanics:["Supplied report ke mutabik scan har 120 seconds mein hota hai aur marker 30 seconds tak dikhta hai.","Marker ek high-value mushroom ki location batata hai."]},
"spirit-fox":{summary:"Med Kit se heal hone par 10 extra HP deta hai.",effects:["Med Kit se milne wale heal mein 10 HP extra add hote hain."],mechanics:["Supplied report ke mutabik Med Kit healing ke saath seedha +10 HP bonus milta hai."]},
"yeti":{summary:"Explosive se aane wala damage 30% kam karta hai.",effects:["Explosive hit lagne par usse milne wala damage 30% kam hota hai."],mechanics:["Supplied report ke mutabik reduction incoming explosive damage par apply hota hai.","Explosive hit ke alawa exact chaalu hona hone ki condition condition report mein nahi di gayi."]},
"zasil":{summary:"Use kiye gaye utility item ko 50% chance se duplicate karta hai.",effects:["Utility item use karne par 50% chance hai ki uski ek extra copy mil jaaye."],mechanics:["Supplied report mein Med Kit, Inhaler aur Repair Kit ko eligible items bataya gaya hai.","Lv4 unlockable ka naam supplied report mein nahi diya gaya."]}
};

const labels: Record<string,string> = {
"Primary effect":"Main effect","Cooldown":"Cooldown","Release data":"Release detail","Detection radius":"Detection ka area","Detection duration":"Detect rehne ka time","Maximum uses":"Match mein maximum uses","Throwing-distance increase":"phenka distance mein increase","Affected items":"Kin items par effect","HP restored":"Wapas milne wala HP","Trigger":"Kab chaalu hona hota hai","Crouching movement-speed increase":"Crouch mein movement speed","Detection effect":"Detection ka effect","Effect":"Effect","EP restored":"Wapas milne wala EP","Numerical skill values":"Skill ke exact numbers","Cooldown parameters":"Cooldown ki details","Rear damage reduction":"Peeche se aane wale damage mein kami","Mitigation cap":"Damage reduction ki maximum limit","Scan radius increase":"Scan area mein increase","Scan feed duration increase":"Scan dikhne ka extra time","EP restoration":"EP recovery","Activation delay":"chaalu hona hone se pehle wait","EP ceiling":"EP ki maximum limit","Damage reduction":"Damage mein kami","Gloo Maker EXP":"Gloo Maker EXP","Additional inventory capacity":"Inventory ke extra slots","HP-to-EP conversion":"HP se EP mein badalna","Protection":"Protection","Additional Gloo Wall HP":"Gloo Wall ke extra HP","Active-skill cooldown reduction":"Active skill ke cooldown mein kami","Maximum reduction":"Maximum reduction","Scan interval":"Scan ka interval","Marker duration":"Marker dikhne ka time","Additional HP":"Extra HP","Explosive damage reduction":"Explosive damage mein kami","Duplication chance":"Duplicate milne ka chance","Trigger items":"chaalu hona hone ki condition hone wale items"
};
const values: Record<string,string> = {
  "3 uses per match": "Ek match mein 3 uses",
  "6 seconds motionless": "6 seconds tak bina hile",
  "Gloo Wall inventory below 2": "Inventory mein 2 se kam Gloo Wall",
  "Reduces enemy marking-skill duration": "Enemy ki marking skill ka effect rehne ka time kam karta hai",
  "+10 HP per Med Kit": "Har Med Kit par +10 HP",
  "Exposes opponents recovering behind structures": "Structures ke peeche recovery kar rahe opponents ko location dikha deta karta hai",
  "Disables enemy auto-aim against the owner during the parachute phase": "Parachute phase mein enemy ka auto-aim owner par kaam nahi karta",
  "Cosmetic-only companion": "Sirf cosmetic pet",
  "Not entered": "Abhi add nahi hua",
  "Pending verification": "Verification pending",
  "Restores 50 EP upon safe zone shrinkage": "Safe Zone chhoti hone par 50 EP wapas deta hai",
  "No cooldown": "Cooldown nahi hai",
  "Purely cosmetic companion": "Sirf cosmetic pet; gameplay skill nahi",
  "Not applicable": "Apply nahi hota",
  "Maximum 3 uses per match (no separate timer supplied)": "Ek match mein maximum 3 uses; alag timer nahi diya",
  "Grenades, Gloo Walls, Flash Freeze, and other throwables (as stated in supplied report)": "Grenades, Gloo Walls, Flash Freeze aur doosri throwable items (supplied report ke mutabik)",
  "Securing an elimination": "Enemy ko eliminate karne par",
  "While crouching": "Crouch karte waqt",
  "Disables enemy auto-aim during the parachute phase": "Parachute phase mein enemy ka auto-aim band karta hai",
  "A teammate is downed": "Teammate knock hone par",
  "Not published in the supplied report": "Supplied report mein nahi diya gaya",
  "2022 · exact patch/date not supplied": "2022 · exact patch/date supplied nahi hai",
  "150 durability points": "150 armor ki majbooti points",
  "Damage received from behind": "Peeche se hit lagne par",
  "+10m": "+10m",
  "+2.5 seconds": "+2.5 seconds",
  "10 EP per second": "Har second 10 EP",
  "Cosmetic companion": "Sirf cosmetic pet",
  "2019-01-22": "2019-01-22",
  "2019 · Early Release": "2019 · Early Release",
  "During interaction animations": "kisi cheez ko use karne ka action animation ke dauran",
  "200 EXP in the first 200 seconds (as stated in supplied report)": "Pehle 200 seconds mein 200 EXP (supplied report ke mutabik)",
  "+45 slots": "45 extra slots",
  "65% of HP healed": "Heal hue HP ka 65%",
  "Repairs armor durability": "Armor ki armor ki majbooti repair karta hai",
  "Prevents high-tier armor destruction": "High-tier armor ko break hone se bachata hai",
  "No cooldown stated in supplied report": "Supplied report mein cooldown nahi diya",
  "Exact release date not published by Garena": "Garena ne exact release date publish nahi ki",
  "+100 HP": "100 extra HP",
  "Exact unified OB39 value not supplied": "OB39 ka exact final value nahi diya gaya",
  "Incoming explosive hit; further trigger details not supplied": "Explosive hit lagne par; baaki chaalu hona hone ki condition details nahi di gayi",
  "Med Kit · Inhaler · Repair Kit": "Med Kit · Inhaler · Repair Kit"
};
export const petRowHinglish = (label:string,value:string) => ({label:labels[label]||label,value:values[value]||value});

export function petPatchHinglish(text:string) {
  const exact: Record<string,string> = {
    "No specific patch-history entry was supplied.":"Koi specific patch-history detail supplied nahi ki gayi.",
    "No patch-history entry was supplied.":"Koi patch-history detail supplied nahi ki gayi.",
    "No additional patch-history entries were supplied.":"Koi extra patch-history entry supplied nahi ki gayi.",
    "The supplied report lists no later balance change.":"Supplied report mein baad ka koi balance change listed nahi hai.",
    "The report states that no balance changes have been recorded since introduction; this has not yet been independently source-checked.":"Report ke mutabik launch ke baad balance change record nahi hua; independent source-check abhi pending hai.",
    "OB41: Mini-map activation optimization stated in the supplied report; exact patch wording remains to be checked.":"OB41: Mini-map chaalu hona hona option ka update report mein diya gaya hai; exact patch wording verify karni baaki hai.",
    "Historical 30%–40% reduction values are mentioned; exact unified OB39 ceiling was not supplied.":"Purane 30%–40% reduction values ka zikr hai; OB39 ki exact maximum limit nahi di gayi."
  };
  if (exact[text]) return exact[text];
  return text
    .replace(": Release date stated in the supplied report; official collaboration and release details remain to be checked.", ": Release date supplied report se li gayi hai; official collaboration aur release details verify karni baaki hain.")
    .replace(": Release date stated in the supplied report.", ": Release date supplied report se li gayi hai.")
    .replace(": Release data stated in the supplied report.", ": Release detail supplied report se li gayi hai.")
    .replace(": release period stated in the supplied report; exact date and patch were not supplied.", ": Release period supplied report mein diya gaya hai; exact date aur patch nahi diye gaye.");
}
