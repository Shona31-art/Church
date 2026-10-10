// The 66 books of the Protestant Bible in order, grouped into the usual
// sections (used by the "Books in order" game).

export const BIBLE_SECTIONS: { name: string; books: string[] }[] = [
  { name: "The Law", books: ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"] },
  {
    name: "History",
    books: ["Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther"],
  },
  { name: "Poetry and Wisdom", books: ["Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon"] },
  { name: "Major Prophets", books: ["Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel"] },
  {
    name: "Minor Prophets",
    books: ["Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi"],
  },
  { name: "Gospels and Acts", books: ["Matthew", "Mark", "Luke", "John", "Acts"] },
  {
    name: "Paul's Letters",
    books: ["Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon"],
  },
  { name: "General Letters and Revelation", books: ["Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"] },
];

export const BIBLE_BOOKS: string[] = BIBLE_SECTIONS.flatMap((s) => s.books);
