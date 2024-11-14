export const INITIAL_TOKENS = 120;
export const INITIAL_HP = 100;
export const INITIAL_ATTRIBUTES = {
  energy: 10,
  focus: 10,
  vitality: 10,
  resilience: 10,
};

export const ACTIVITY_TYPES = {
  YOGA: "yoga",
  MEDITATION: "meditation",
  NUTRITION: "nutrition",
  HOLISTIC: "holistic",
};

export const ACTIVITY_REWARDS = {
  [ACTIVITY_TYPES.YOGA]: { primaryAttribute: "energy", reward: 5 },
  [ACTIVITY_TYPES.MEDITATION]: { primaryAttribute: "focus", reward: 5 },
  [ACTIVITY_TYPES.NUTRITION]: { primaryAttribute: "vitality", reward: 5 },
  [ACTIVITY_TYPES.HOLISTIC]: { primaryAttribute: "resilience", reward: 5 },
};

export const QUALITY_TIERS = {
  Common: { bg: "bg-gray-400", text: "text-gray-100", border: "border-gray-400/60" },
  Uncommon: { bg: "bg-green-400", text: "text-green-100", border: "border-green-400/60" },
  Rare: { bg: "bg-blue-400", text: "text-blue-100", border: "border-blue-400/60" },
  Epic: { bg: "bg-purple-400", text: "text-purple-100", border: "border-purple-400/60" },
  Legendary: { bg: "bg-yellow-400", text: "text-yellow-100", border: "border-yellow-400/60" },
  Mythic: { bg: "bg-red-400", text: "text-red-100", border: "border-red-400/60" }
};


export const AVATAR_TYPES = [
  "Fitness Champion",
  "Mindfulness Master",
  "Nutrition Expert",
  "Holistic Healer",
];

export const PROFESSIONAL_TYPES = [
  "Medical Specialist",
  "Mental Health Expert",
  "Nutritional Advisor",
  "Physical Trainer",
];

export const FACILITY_TYPES = [
  "Health Hub",
  "Fitness Center",
  "Wellness Retreat",
  "Medical Clinic",
];

export const generateNFT = (type, types) => ({
  id: Math.random().toString(36).substr(2, 9),
  type: types[Math.floor(Math.random() * types.length)],
  quality:
    Object.keys(QUALITY_TIERS)[
      Math.floor(Math.random() * Object.keys(QUALITY_TIERS).length)
    ],
  dailyCapacity: Math.floor(Math.random() * 10) + 1,
  visitCount: 0,
  level: 1,
  hp: INITIAL_HP,
  tokens: INITIAL_TOKENS,
  gems: 0,
  attributes: { ...INITIAL_ATTRIBUTES },
});
