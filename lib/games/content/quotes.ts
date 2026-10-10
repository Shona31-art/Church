// "Who said it?" — quotations from the World English Bible (public domain),
// each with its reference so a pastor can check the wording and speaker.

import type { Level } from "../catalog";

export interface BibleQuote {
  quote: string;
  speaker: string;
  reference: string;
  level: Level;
  kids?: boolean;
}

export const BIBLE_QUOTES: BibleQuote[] = [
  // --- Easy ---------------------------------------------------------------
  { quote: "Let there be light.", speaker: "God", reference: "Genesis 1:3", level: "easy", kids: true },
  { quote: "It is finished.", speaker: "Jesus", reference: "John 19:30", level: "easy", kids: true },
  { quote: "Behold, the Lamb of God, who takes away the sin of the world!", speaker: "John the Baptist", reference: "John 1:29", level: "easy", kids: true },
  { quote: "You are the Christ, the Son of the living God.", speaker: "Peter", reference: "Matthew 16:16", level: "easy" },
  { quote: "My Lord and my God!", speaker: "Thomas", reference: "John 20:28", level: "easy", kids: true },
  { quote: "Yahweh is my shepherd; I shall lack nothing.", speaker: "David", reference: "Psalm 23:1", level: "easy", kids: true },
  { quote: "Here I am. Send me!", speaker: "Isaiah", reference: "Isaiah 6:8", level: "easy" },
  { quote: "I am the bread of life.", speaker: "Jesus", reference: "John 6:35", level: "easy", kids: true },
  { quote: "Do whatever he says to you.", speaker: "Mary", reference: "John 2:5", level: "easy", kids: true },
  { quote: "Am I my brother's keeper?", speaker: "Cain", reference: "Genesis 4:9", level: "easy" },
  { quote: "As for me and my house, we will serve Yahweh.", speaker: "Joshua", reference: "Joshua 24:15", level: "easy" },
  { quote: "Speak; for your servant hears.", speaker: "Samuel", reference: "1 Samuel 3:10", level: "easy", kids: true },

  // --- Medium -------------------------------------------------------------
  { quote: "Where you go, I will go; and where you stay, I will stay.", speaker: "Ruth", reference: "Ruth 1:16", level: "medium" },
  { quote: "If I perish, I perish.", speaker: "Esther", reference: "Esther 4:16", level: "medium" },
  { quote: "Yahweh gave, and Yahweh has taken away. Blessed be Yahweh's name.", speaker: "Job", reference: "Job 1:21", level: "medium" },
  { quote: "He must increase, but I must decrease.", speaker: "John the Baptist", reference: "John 3:30", level: "medium" },
  { quote: "What is truth?", speaker: "Pontius Pilate", reference: "John 18:38", level: "medium" },
  { quote: "Silver and gold have I none, but what I have, that I give you.", speaker: "Peter", reference: "Acts 3:6", level: "medium" },
  { quote: "For to me to live is Christ, and to die is gain.", speaker: "Paul", reference: "Philippians 1:21", level: "medium" },
  { quote: "I have fought the good fight. I have finished the course. I have kept the faith.", speaker: "Paul", reference: "2 Timothy 4:7", level: "medium" },
  { quote: "Behold, the servant of the Lord; let it be done to me according to your word.", speaker: "Mary", reference: "Luke 1:38", level: "medium" },
  { quote: "God will provide himself the lamb for a burnt offering, my son.", speaker: "Abraham", reference: "Genesis 22:8", level: "medium" },
  { quote: "I will not let you go, unless you bless me.", speaker: "Jacob", reference: "Genesis 32:26", level: "medium" },
  { quote: "Who am I, that I should go to Pharaoh?", speaker: "Moses", reference: "Exodus 3:11", level: "medium" },
  { quote: "Lord, teach us to pray.", speaker: "One of the disciples", reference: "Luke 11:1", level: "medium" },
  { quote: "How can a man be born when he is old?", speaker: "Nicodemus", reference: "John 3:4", level: "medium" },

  // --- Hard ---------------------------------------------------------------
  { quote: "You meant evil against me, but God meant it for good.", speaker: "Joseph", reference: "Genesis 50:20", level: "hard" },
  { quote: "Who knows if you haven't come to the kingdom for such a time as this?", speaker: "Mordecai", reference: "Esther 4:14", level: "hard" },
  { quote: "Is anything too hard for Yahweh?", speaker: "God", reference: "Genesis 18:14", level: "hard" },
  { quote: "Lord, remember me when you come into your Kingdom.", speaker: "The criminal on the cross", reference: "Luke 23:42", level: "hard" },
  { quote: "Come, see a man who told me everything that I did.", speaker: "The Samaritan woman", reference: "John 4:29", level: "hard" },
  { quote: "Who is my neighbor?", speaker: "A lawyer", reference: "Luke 10:29", level: "hard" },
  { quote: "I believe. Help my unbelief!", speaker: "A boy's father", reference: "Mark 9:24", level: "hard" },
  { quote: "Sirs, what must I do to be saved?", speaker: "The Philippian jailer", reference: "Acts 16:30", level: "hard" },
  { quote: "Do you understand what you are reading?", speaker: "Philip", reference: "Acts 8:30", level: "hard" },
  { quote: "Teacher, don't you care that we are dying?", speaker: "The disciples", reference: "Mark 4:38", level: "hard" },
  { quote: "Lord, if it is you, command me to come to you on the waters.", speaker: "Peter", reference: "Matthew 14:28", level: "hard" },
  { quote: "Not my will, but yours, be done.", speaker: "Jesus", reference: "Luke 22:42", level: "hard" },
];
