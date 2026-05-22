import pekingDuckImg from "@/assets/dishes/peking-duck.jpg";
import xiaolongbaoImg from "@/assets/dishes/xiaolongbao.jpg";
import hotpotImg from "@/assets/dishes/chongqing-hotpot.jpg";
import mapoTofuImg from "@/assets/dishes/mapo-tofu.jpg";
import buddhasDelightImg from "@/assets/dishes/buddhas-delight.jpg";
import eggFriedRiceImg from "@/assets/dishes/egg-fried-rice.jpg";
import biangbiangImg from "@/assets/dishes/biangbiang-noodles.jpg";
import lambSkewersImg from "@/assets/dishes/lamb-skewers.jpg";
import roujiamoImg from "@/assets/dishes/roujiamo.jpg";

export interface Dish {
  id: string;
  name: string;
  nameZh: string;
  region: string;
  description: string;
  tip: string;
  emoji: string;
  bg: string;
  image: string;
  spice: number; // 0-3
  vegetarian: boolean;
  halal: boolean;
  containsPork: boolean;
  allergens: string[];
  restaurantsByCity: Record<string, string[]>;
}

export const dishes: Dish[] = [
  {
    id: "peking-duck",
    name: "Peking Duck",
    nameZh: "北京烤鸭",
    region: "Beijing",
    description: "Crispy-skinned roast duck carved tableside, served with pancakes, scallions, and hoisin.",
    tip: "Order half a duck if dining solo or as a couple. Ask for skin-first with sugar.",
    emoji: "🦆",
    bg: "from-amber-100 to-orange-200",
    spice: 0,
    vegetarian: false,
    halal: false,
    containsPork: false,
    allergens: ["Gluten", "Soy"],
    restaurantsByCity: { BJ: ["BJ005", "BJ022", "BJ023"] },
  },
  {
    id: "xiaolongbao",
    name: "Xiaolongbao",
    nameZh: "小笼包",
    region: "Shanghai",
    description: "Steamed soup dumplings filled with seasoned pork and a sip of rich broth.",
    tip: "Bite a small hole, slurp the soup, then eat. Don't drop it in the vinegar whole.",
    emoji: "🥟",
    bg: "from-rose-100 to-pink-200",
    spice: 0,
    vegetarian: false,
    halal: false,
    containsPork: true,
    allergens: ["Gluten", "Soy"],
    restaurantsByCity: { SH: ["SH024", "SH047", "SH026"] },
  },
  {
    id: "chongqing-hotpot",
    name: "Chongqing Hotpot",
    nameZh: "重庆火锅",
    region: "Chongqing",
    description: "Numbingly spicy málà broth where you cook thinly sliced meats and vegetables at the table.",
    tip: "Ask for a split pot (yuan-yang) if you want a mild side. Sesame oil dip cools the heat.",
    emoji: "🍲",
    bg: "from-red-100 to-rose-200",
    spice: 3,
    vegetarian: false,
    halal: false,
    containsPork: false,
    allergens: ["Soy", "Sesame"],
    restaurantsByCity: { CQ: ["CQ022", "CQ021"], BJ: ["BJ024", "BJ025"] },
  },
  {
    id: "mapo-tofu",
    name: "Mapo Tofu",
    nameZh: "麻婆豆腐",
    region: "Sichuan",
    description: "Silken tofu in a spicy, numbing chili-bean sauce with Sichuan peppercorns.",
    tip: "Ask for the vegetarian version (素麻婆) — traditional includes minced pork or beef.",
    emoji: "🌶️",
    bg: "from-orange-100 to-red-200",
    spice: 3,
    vegetarian: true,
    halal: true,
    containsPork: false,
    allergens: ["Soy"],
    restaurantsByCity: { CQ: ["CQ024", "CQ021"], BJ: ["BJ028"] },
  },
  {
    id: "buddhas-delight",
    name: "Buddha's Delight",
    nameZh: "罗汉斋",
    region: "All China",
    description: "A traditional vegetarian medley of tofu, mushrooms, and seasonal vegetables.",
    tip: "Found at Buddhist temple restaurants — King's Joy in Beijing is a Michelin pick.",
    emoji: "🥬",
    bg: "from-green-100 to-emerald-200",
    spice: 0,
    vegetarian: true,
    halal: true,
    containsPork: false,
    allergens: ["Soy", "Sesame"],
    restaurantsByCity: { BJ: ["BJ027", "BJ028"] },
  },
  {
    id: "egg-fried-rice",
    name: "Egg Fried Rice",
    nameZh: "蛋炒饭",
    region: "All China",
    description: "A safe, filling staple available everywhere. Wok-tossed rice with egg and scallions.",
    tip: "Ask for it without meat (不要肉) to keep it strictly vegetarian.",
    emoji: "🍚",
    bg: "from-yellow-100 to-amber-200",
    spice: 0,
    vegetarian: true,
    halal: true,
    containsPork: false,
    allergens: ["Egg", "Soy"],
    restaurantsByCity: {
      BJ: ["BJ028", "BJ027"],
      SH: ["SH037", "SH047"],
      CQ: ["CQ024"],
      XA: ["XA019"],
    },
  },
  {
    id: "biangbiang-noodles",
    name: "Biangbiang Noodles",
    nameZh: "Biang Biang 面",
    region: "Xi'an",
    description: "Hand-pulled belt-wide noodles tossed with chili oil, garlic, and vinegar.",
    tip: "Order them 'oil splashed' (油泼) for the classic Xi'an street version.",
    emoji: "🍜",
    bg: "from-amber-100 to-yellow-200",
    spice: 2,
    vegetarian: true,
    halal: true,
    containsPork: false,
    allergens: ["Gluten"],
    restaurantsByCity: { XA: ["XA017", "XA020"] },
  },
  {
    id: "lamb-skewers",
    name: "Lamb Skewers",
    nameZh: "羊肉串",
    region: "Northwest",
    description: "Cumin-spiced grilled lamb skewers, a Xinjiang street-food classic.",
    tip: "Halal-certified at most Muslim Quarter stalls — look for the green crescent sign.",
    emoji: "🍢",
    bg: "from-orange-100 to-amber-200",
    spice: 1,
    vegetarian: false,
    halal: true,
    containsPork: false,
    allergens: [],
    restaurantsByCity: { XA: ["XA021", "XA016"], BJ: ["BJ026"] },
  },
  {
    id: "roujiamo",
    name: "Roujiamo",
    nameZh: "肉夹馍",
    region: "Xi'an",
    description: "Crispy flatbread stuffed with slow-braised meat — sometimes called the 'Chinese burger'.",
    tip: "Pork is most common; ask for beef (牛肉) at halal stalls in the Muslim Quarter.",
    emoji: "🥙",
    bg: "from-orange-100 to-red-200",
    spice: 1,
    vegetarian: false,
    halal: false,
    containsPork: true,
    allergens: ["Gluten"],
    restaurantsByCity: { XA: ["XA016"] },
  },
];
