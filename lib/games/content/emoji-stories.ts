// "Guess the Bible story" emoji puzzles. Original combinations written for
// this app (not taken from any published emoji quiz). Every story carries a
// reference so a pastor can check it.
//
// `keywords`: for Hard (typed answers) — an answer is right if it contains any
// one of these, after lower-casing and dropping punctuation. Keep them
// specific enough that a wrong story can't match by accident.

import type { Level } from "../catalog";

export interface EmojiStory {
  emoji: string;
  answer: string;
  keywords: string[];
  reference: string;
  level: Level;
  kids?: boolean;
}

export const EMOJI_STORIES: EmojiStory[] = [
  // --- Easy ---------------------------------------------------------------
  { emoji: "🌧️🚢🐘🦒🌈", answer: "Noah's ark", keywords: ["noah", "ark", "flood"], reference: "Genesis 6–9", level: "easy", kids: true },
  { emoji: "🙋‍♂️🌊🐋", answer: "Jonah and the big fish", keywords: ["jonah"], reference: "Jonah 1–2", level: "easy", kids: true },
  { emoji: "👦🪨💫🧔‍♂️", answer: "David and Goliath", keywords: ["goliath", "david"], reference: "1 Samuel 17", level: "easy", kids: true },
  { emoji: "🙏🦁🦁🕳️", answer: "Daniel in the lions' den", keywords: ["daniel", "lion"], reference: "Daniel 6", level: "easy", kids: true },
  { emoji: "👶🧺🌊👸", answer: "Baby Moses in the basket", keywords: ["baby moses", "basket", "moses"], reference: "Exodus 2:1-10", level: "easy", kids: true },
  { emoji: "🌊🚶‍♂️🌊🚶‍♀️🌊", answer: "Crossing the Red Sea", keywords: ["red sea", "parting", "crossing the sea"], reference: "Exodus 14", level: "easy", kids: true },
  { emoji: "⭐🐑🐄👶", answer: "The birth of Jesus", keywords: ["birth of jesus", "nativity", "jesus born", "christmas", "manger"], reference: "Luke 2:1-20", level: "easy", kids: true },
  { emoji: "🍞🍞🍞🍞🍞🐟🐟👥👥👥", answer: "Feeding the five thousand", keywords: ["5000", "five thousand", "feeding", "loaves"], reference: "John 6:1-14", level: "easy", kids: true },
  { emoji: "🚶‍♂️🌊⛵😮", answer: "Jesus walks on water", keywords: ["walk on water", "walks on water", "walking on water", "walked on water"], reference: "Matthew 14:22-33", level: "easy", kids: true },
  { emoji: "🌍☀️🌙🌳🐟🐦", answer: "Creation", keywords: ["creation", "create", "made the world"], reference: "Genesis 1", level: "easy", kids: true },
  { emoji: "🍎🐍👫", answer: "Adam and Eve and the fruit", keywords: ["adam", "eve", "fall", "garden of eden"], reference: "Genesis 3", level: "easy", kids: true },
  { emoji: "🧔🌳👀🏠", answer: "Zacchaeus up the tree", keywords: ["zacchaeus", "zaccheus"], reference: "Luke 19:1-10", level: "easy", kids: true },
  { emoji: "🐑❓🔍🎉", answer: "The lost sheep", keywords: ["lost sheep"], reference: "Luke 15:3-7", level: "easy", kids: true },
  { emoji: "🎺🎺🎺🧱💥", answer: "The walls of Jericho", keywords: ["jericho"], reference: "Joshua 6", level: "easy", kids: true },
  { emoji: "🔥🌿👞", answer: "Moses and the burning bush", keywords: ["burning bush"], reference: "Exodus 3:1-6", level: "easy", kids: true },
  { emoji: "⛰️📜🔟", answer: "The Ten Commandments", keywords: ["ten commandments", "10 commandments", "commandments"], reference: "Exodus 20", level: "easy", kids: true },
  { emoji: "🤕🛣️🚶‍♂️🚶‍♂️🫶", answer: "The good Samaritan", keywords: ["samaritan"], reference: "Luke 10:25-37", level: "easy", kids: true },
  { emoji: "👦💰🐷🏠🤗", answer: "The prodigal son", keywords: ["prodigal", "lost son"], reference: "Luke 15:11-32", level: "easy", kids: true },
  { emoji: "✝️🪨➡️☀️👼", answer: "The resurrection", keywords: ["resurrection", "risen", "rose again", "empty tomb", "easter"], reference: "Matthew 28:1-10", level: "easy", kids: true },
  { emoji: "🌴🐴👑", answer: "Palm Sunday", keywords: ["palm sunday", "triumphal entry", "entry into jerusalem"], reference: "John 12:12-15", level: "easy", kids: true },

  // --- Medium -------------------------------------------------------------
  { emoji: "💪💇‍♂️✂️🏛️", answer: "Samson and Delilah", keywords: ["samson", "delilah"], reference: "Judges 16", level: "medium" },
  { emoji: "🧥🌈👬😠🕳️", answer: "Joseph's coat", keywords: ["joseph"], reference: "Genesis 37", level: "medium" },
  { emoji: "🔥🐎🌪️⬆️", answer: "Elijah taken up to heaven", keywords: ["elijah", "chariot", "whirlwind"], reference: "2 Kings 2:11", level: "medium" },
  { emoji: "🐑🧶💧🌙", answer: "Gideon's fleece", keywords: ["gideon", "fleece"], reference: "Judges 6:36-40", level: "medium" },
  { emoji: "🌾👩‍🌾🤝👨", answer: "Ruth and Boaz", keywords: ["ruth", "boaz"], reference: "Ruth 2", level: "medium" },
  { emoji: "👑👸🙏📜", answer: "Queen Esther", keywords: ["esther"], reference: "Esther 4–7", level: "medium" },
  { emoji: "😴🪜👼👼", answer: "Jacob's ladder", keywords: ["jacob", "ladder", "stairway"], reference: "Genesis 28:10-17", level: "medium" },
  { emoji: "🔥🏙️👀🧂", answer: "Lot's wife", keywords: ["lot", "pillar of salt", "salt"], reference: "Genesis 19:26", level: "medium" },
  { emoji: "💒🏺💧➡️🍷", answer: "Water into wine", keywords: ["water into wine", "wedding at cana", "cana"], reference: "John 2:1-11", level: "medium" },
  { emoji: "⚰️4️⃣📅🗣️🚶", answer: "Lazarus raised from the dead", keywords: ["lazarus"], reference: "John 11", level: "medium" },
  { emoji: "🐓3️⃣🙅‍♂️", answer: "Peter's denial", keywords: ["denial", "denies", "denied", "peter"], reference: "Luke 22:54-62", level: "medium" },
  { emoji: "🔥🗣️🌍💨", answer: "Pentecost", keywords: ["pentecost", "holy spirit"], reference: "Acts 2:1-13", level: "medium" },
  { emoji: "🛣️💡😵‍💫👀", answer: "Paul on the road to Damascus", keywords: ["damascus", "saul", "paul"], reference: "Acts 9:1-19", level: "medium" },
  { emoji: "🍞🍷👥1️⃣2️⃣", answer: "The Last Supper", keywords: ["last supper", "lord's supper", "lords supper", "communion"], reference: "Luke 22:14-20", level: "medium" },
  { emoji: "🎣❌➡️🐟🐟🐟🛶", answer: "The miraculous catch of fish", keywords: ["catch", "fish"], reference: "Luke 5:1-11", level: "medium" },
  { emoji: "👵🪙🪙🏛️", answer: "The widow's offering", keywords: ["widow"], reference: "Mark 12:41-44", level: "medium" },
  { emoji: "🌱➡️🌳🐦", answer: "The mustard seed", keywords: ["mustard"], reference: "Matthew 13:31-32", level: "medium" },
  { emoji: "⛰️👴👦🪵🐏", answer: "Abraham and Isaac", keywords: ["abraham", "isaac"], reference: "Genesis 22", level: "medium" },
  { emoji: "🏜️☁️🍞⬇️", answer: "Manna from heaven", keywords: ["manna"], reference: "Exodus 16", level: "medium" },
  { emoji: "🧱🧱🗼🗣️❓", answer: "The tower of Babel", keywords: ["babel"], reference: "Genesis 11:1-9", level: "medium" },

  // --- Hard ---------------------------------------------------------------
  { emoji: "🫏🗣️👼🗡️", answer: "Balaam's donkey", keywords: ["balaam", "talking donkey"], reference: "Numbers 22:21-35", level: "hard" },
  { emoji: "⛺🔨😴", answer: "Jael and Sisera", keywords: ["jael", "sisera"], reference: "Judges 4:17-22", level: "hard" },
  { emoji: "🪓🌊⬆️", answer: "Elisha's floating axe head", keywords: ["axe", "ax"], reference: "2 Kings 6:1-7", level: "hard" },
  { emoji: "🧖‍♂️7️⃣🌊✨", answer: "Naaman healed in the Jordan", keywords: ["naaman"], reference: "2 Kings 5:1-14", level: "hard" },
  { emoji: "🍷✋✍️🧱", answer: "The writing on the wall", keywords: ["writing on the wall", "belshazzar", "handwriting"], reference: "Daniel 5", level: "hard" },
  { emoji: "😴🪟⬇️🙌", answer: "Eutychus falls from the window", keywords: ["eutychus"], reference: "Acts 20:7-12", level: "hard" },
  { emoji: "🔥🧍🧍🧍👤", answer: "The fiery furnace", keywords: ["furnace", "shadrach", "meshach", "abednego"], reference: "Daniel 3", level: "hard" },
  { emoji: "🚢💥🏝️🐍", answer: "Paul's shipwreck on Malta", keywords: ["shipwreck", "malta"], reference: "Acts 27–28", level: "hard" },
  { emoji: "🧵🔴🪟🧱", answer: "Rahab's scarlet cord", keywords: ["rahab"], reference: "Joshua 2", level: "hard" },
  { emoji: "🙏😢👶🏛️", answer: "Hannah prays for a son", keywords: ["hannah"], reference: "1 Samuel 1", level: "hard" },
  { emoji: "⛓️👼🚪🏃", answer: "Peter freed from prison", keywords: ["peter freed", "peter escapes", "peter in prison", "prison"], reference: "Acts 12:5-11", level: "hard" },
  { emoji: "🛞📜🙋‍♂️💧", answer: "Philip and the Ethiopian", keywords: ["ethiopian", "eunuch"], reference: "Acts 8:26-39", level: "hard" },
  { emoji: "🦴🦴🌬️🧍🧍", answer: "The valley of dry bones", keywords: ["dry bones", "valley of bones", "ezekiel"], reference: "Ezekiel 37:1-14", level: "hard" },
  { emoji: "🌿🐛☀️😠", answer: "Jonah's plant", keywords: ["jonah's plant", "jonahs plant", "vine", "plant", "gourd"], reference: "Jonah 4:6-9", level: "hard" },
  { emoji: "🧱🛠️🗡️🧱", answer: "Rebuilding Jerusalem's walls", keywords: ["nehemiah", "walls of jerusalem", "rebuild"], reference: "Nehemiah 4:17-18", level: "hard" },
  { emoji: "🪨💧🪄😠", answer: "Moses strikes the rock", keywords: ["strikes the rock", "struck the rock", "water from the rock", "rock"], reference: "Numbers 20:7-12", level: "hard" },
  { emoji: "🐍🪵⬆️👀", answer: "The bronze serpent", keywords: ["bronze serpent", "brass serpent", "snake on a pole", "serpent"], reference: "Numbers 21:4-9", level: "hard" },
  { emoji: "☀️⏸️⚔️", answer: "The sun stands still", keywords: ["sun stood still", "sun stands still", "sun stand still"], reference: "Joshua 10:12-14", level: "hard" },
];
