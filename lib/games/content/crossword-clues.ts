// Crossword clue bank. Original clues (not copied from any puzzle book or
// site); every entry carries a Bible reference so a pastor can check it.
// Quotations follow the World English Bible (public domain), e.g. "Yahweh".
//
// Answers: capital letters only, no spaces. `kids` marks clues suitable for
// Kids mode (simple wording, well-known stories).

import type { Level } from "../catalog";

export interface CrosswordClue {
  answer: string;
  clue: string;
  reference: string;
  level: Level;
  kids?: boolean;
}

export const CROSSWORD_CLUES: CrosswordClue[] = [
  // --- Easy ---------------------------------------------------------------
  { answer: "NOAH", clue: "Built an ark before the flood", reference: "Genesis 6:14", level: "easy", kids: true },
  { answer: "MOSES", clue: "Led Israel out of Egypt", reference: "Exodus 3:10", level: "easy", kids: true },
  { answer: "DAVID", clue: "Shepherd boy who defeated a giant", reference: "1 Samuel 17:50", level: "easy", kids: true },
  { answer: "GOLIATH", clue: "Giant from Gath", reference: "1 Samuel 17:4", level: "easy", kids: true },
  { answer: "JONAH", clue: "Swallowed by a great fish", reference: "Jonah 1:17", level: "easy", kids: true },
  { answer: "ADAM", clue: "The first man", reference: "Genesis 2:7", level: "easy", kids: true },
  { answer: "EVE", clue: "The first woman", reference: "Genesis 3:20", level: "easy", kids: true },
  { answer: "EDEN", clue: "Garden God planted for Adam and Eve", reference: "Genesis 2:8", level: "easy", kids: true },
  { answer: "ARK", clue: "Noah's great boat", reference: "Genesis 6:14", level: "easy", kids: true },
  { answer: "MANNA", clue: "Bread from heaven in the wilderness", reference: "Exodus 16:31", level: "easy", kids: true },
  { answer: "LIONS", clue: "Daniel was thrown into their den", reference: "Daniel 6:16", level: "easy", kids: true },
  { answer: "PETER", clue: "Fisherman who walked on water towards Jesus", reference: "Matthew 14:29", level: "easy", kids: true },
  { answer: "PAUL", clue: "Apostle who saw a light on the road to Damascus", reference: "Acts 9:3", level: "easy" },
  { answer: "MARY", clue: "Mother of Jesus", reference: "Luke 1:30-31", level: "easy", kids: true },
  { answer: "BETHLEHEM", clue: "Town where Jesus was born", reference: "Matthew 2:1", level: "easy", kids: true },
  { answer: "RAINBOW", clue: "Sign of God's promise after the flood", reference: "Genesis 9:13", level: "easy", kids: true },
  { answer: "DOVE", clue: "Bird that returned to Noah with an olive leaf", reference: "Genesis 8:11", level: "easy", kids: true },
  { answer: "STAR", clue: "Led the wise men to Jesus", reference: "Matthew 2:9", level: "easy", kids: true },
  { answer: "LAMB", clue: "John called Jesus the ___ of God", reference: "John 1:29", level: "easy", kids: true },
  { answer: "SHEPHERD", clue: "Psalm 23: \"Yahweh is my ___\"", reference: "Psalm 23:1", level: "easy", kids: true },
  { answer: "LOVE", clue: "\"God is ___\"", reference: "1 John 4:8", level: "easy", kids: true },
  { answer: "PRAY", clue: "\"___ without ceasing\"", reference: "1 Thessalonians 5:17", level: "easy", kids: true },
  { answer: "GENESIS", clue: "First book of the Bible", reference: "Genesis 1:1", level: "easy", kids: true },
  { answer: "EXODUS", clue: "Second book of the Bible", reference: "Exodus 1:1", level: "easy" },
  { answer: "CROSS", clue: "Jesus was obedient to death on a ___", reference: "Philippians 2:8", level: "easy", kids: true },
  { answer: "FAITH", clue: "\"Assurance of things hoped for\"", reference: "Hebrews 11:1", level: "easy" },
  { answer: "GRACE", clue: "\"By ___ you have been saved through faith\"", reference: "Ephesians 2:8", level: "easy" },
  { answer: "JESUS", clue: "Name given because \"he shall save his people from their sins\"", reference: "Matthew 1:21", level: "easy", kids: true },

  // --- Medium -------------------------------------------------------------
  { answer: "ABRAHAM", clue: "Renamed as \"father of a multitude of nations\"", reference: "Genesis 17:5", level: "medium" },
  { answer: "SARAH", clue: "Laughed when told she would have a son in old age", reference: "Genesis 18:12", level: "medium" },
  { answer: "ISAAC", clue: "Son of Abraham and Sarah", reference: "Genesis 21:3", level: "medium" },
  { answer: "JACOB", clue: "Wrestled with God and was renamed Israel", reference: "Genesis 32:28", level: "medium" },
  { answer: "JOSEPH", clue: "Given a tunic of many colours", reference: "Genesis 37:3", level: "medium" },
  { answer: "ESTHER", clue: "Queen who risked her life to save her people", reference: "Esther 4:16", level: "medium" },
  { answer: "RUTH", clue: "Said \"your people will be my people\"", reference: "Ruth 1:16", level: "medium" },
  { answer: "SAMSON", clue: "Strong man whose strength went when his hair was cut", reference: "Judges 16:19", level: "medium" },
  { answer: "GIDEON", clue: "Tested God's call with a fleece", reference: "Judges 6:37", level: "medium" },
  { answer: "DEBORAH", clue: "Prophetess who judged Israel", reference: "Judges 4:4", level: "medium" },
  { answer: "ELIJAH", clue: "Prophet taken up to heaven in a whirlwind", reference: "2 Kings 2:11", level: "medium" },
  { answer: "ELISHA", clue: "Asked for a double portion of Elijah's spirit", reference: "2 Kings 2:9", level: "medium" },
  { answer: "SOLOMON", clue: "King who asked God for wisdom", reference: "1 Kings 3:9", level: "medium" },
  { answer: "SAMUEL", clue: "Boy who heard God call his name at night", reference: "1 Samuel 3:10", level: "medium" },
  { answer: "JERICHO", clue: "City whose walls fell down", reference: "Joshua 6:20", level: "medium" },
  { answer: "NAZARETH", clue: "Town where Jesus was brought up", reference: "Luke 4:16", level: "medium" },
  { answer: "GALILEE", clue: "Sea Jesus walked across", reference: "John 6:1, 19", level: "medium" },
  { answer: "JORDAN", clue: "River where Jesus was baptised", reference: "Matthew 3:13", level: "medium" },
  { answer: "LAZARUS", clue: "Raised from the dead after four days", reference: "John 11:39-44", level: "medium" },
  { answer: "MARTHA", clue: "Sister distracted with much serving", reference: "Luke 10:40", level: "medium" },
  { answer: "ZACCHAEUS", clue: "Tax collector who climbed a sycamore tree", reference: "Luke 19:4", level: "medium" },
  { answer: "MATTHEW", clue: "Tax collector Jesus called to follow him", reference: "Matthew 9:9", level: "medium" },
  { answer: "THOMAS", clue: "Disciple who wanted to see the nail marks", reference: "John 20:25", level: "medium" },
  { answer: "SINAI", clue: "Mountain where God gave the law", reference: "Exodus 19:20", level: "medium" },
  { answer: "PSALMS", clue: "Book of 150 songs and prayers", reference: "Psalm 150", level: "medium" },
  { answer: "PENTECOST", clue: "Day the Holy Spirit came on the disciples", reference: "Acts 2:1-4", level: "medium" },
  { answer: "BOAZ", clue: "Kinsman who married Ruth", reference: "Ruth 4:13", level: "medium" },
  { answer: "NAOMI", clue: "Ruth's mother-in-law", reference: "Ruth 1:16", level: "medium" },
  { answer: "AARON", clue: "Moses' brother, Israel's first high priest", reference: "Exodus 28:1", level: "medium" },
  { answer: "MIRIAM", clue: "Moses' sister who led the women in song", reference: "Exodus 15:20", level: "medium" },
  { answer: "NINEVEH", clue: "City Jonah was sent to warn", reference: "Jonah 1:2", level: "medium" },
  { answer: "DANIEL", clue: "Prayed three times a day despite the king's decree", reference: "Daniel 6:10", level: "medium" },

  // --- Hard ---------------------------------------------------------------
  { answer: "NEHEMIAH", clue: "Cupbearer who rebuilt Jerusalem's walls", reference: "Nehemiah 2:1-5", level: "hard" },
  { answer: "EZRA", clue: "Scribe who set his heart to teach the law", reference: "Ezra 7:10", level: "hard" },
  { answer: "HABAKKUK", clue: "Prophet who cried \"How long, Yahweh?\"", reference: "Habakkuk 1:2", level: "hard" },
  { answer: "MELCHIZEDEK", clue: "King of Salem and priest of God Most High", reference: "Genesis 14:18", level: "hard" },
  { answer: "METHUSELAH", clue: "Lived 969 years", reference: "Genesis 5:27", level: "hard" },
  { answer: "BARNABAS", clue: "Name meaning \"Son of Encouragement\"", reference: "Acts 4:36", level: "hard" },
  { answer: "LYDIA", clue: "Seller of purple cloth from Thyatira", reference: "Acts 16:14", level: "hard" },
  { answer: "TABITHA", clue: "Disciple at Joppa raised by Peter", reference: "Acts 9:36-40", level: "hard" },
  { answer: "EUTYCHUS", clue: "Fell from a window during Paul's long talk", reference: "Acts 20:9", level: "hard" },
  { answer: "NICODEMUS", clue: "Pharisee who came to Jesus by night", reference: "John 3:1-2", level: "hard" },
  { answer: "SILAS", clue: "Sang hymns with Paul in the Philippian jail", reference: "Acts 16:25", level: "hard" },
  { answer: "TIMOTHY", clue: "His grandmother Lois shared his sincere faith", reference: "2 Timothy 1:5", level: "hard" },
  { answer: "ONESIMUS", clue: "Runaway Paul sent back to Philemon", reference: "Philemon 1:10-12", level: "hard" },
  { answer: "GOMER", clue: "Hosea's wife", reference: "Hosea 1:3", level: "hard" },
  { answer: "JETHRO", clue: "Moses' father-in-law who advised him to share the load", reference: "Exodus 18:17-18", level: "hard" },
  { answer: "JOSIAH", clue: "King in whose reign the Book of the Law was found", reference: "2 Kings 22:8", level: "hard" },
  { answer: "HEZEKIAH", clue: "King given fifteen more years of life", reference: "2 Kings 20:6", level: "hard" },
  { answer: "PATMOS", clue: "Island where John received the Revelation", reference: "Revelation 1:9", level: "hard" },
  { answer: "ANTIOCH", clue: "Where the disciples were first called Christians", reference: "Acts 11:26", level: "hard" },
  { answer: "GETHSEMANE", clue: "Where Jesus prayed before his arrest", reference: "Matthew 26:36", level: "hard" },
  { answer: "GOLGOTHA", clue: "\"The place of a skull\"", reference: "Matthew 27:33", level: "hard" },
  { answer: "EMMAUS", clue: "Village two disciples walked to with the risen Jesus", reference: "Luke 24:13-15", level: "hard" },
  { answer: "ENOCH", clue: "Walked with God, and God took him", reference: "Genesis 5:24", level: "hard" },
  { answer: "SHADRACH", clue: "One of three thrown into the fiery furnace", reference: "Daniel 3:20", level: "hard" },
  { answer: "BEREA", clue: "Its people examined the Scriptures daily", reference: "Acts 17:10-11", level: "hard" },
];
