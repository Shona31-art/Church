// Church certificates (church_life.sql): the wording for each kind.

export const CERTIFICATE_KINDS = ["baptism", "dedication", "membership", "course"] as const;
export type CertificateKind = (typeof CERTIFICATE_KINDS)[number];

export const CERTIFICATE_INFO: Record<CertificateKind, { label: string; heading: string; scripture: string }> = {
  baptism: { label: "Baptism", heading: "Certificate of Baptism", scripture: "We were therefore buried with him through baptism into death in order that, just as Christ was raised from the dead, we too may live a new life. — Romans 6:4" },
  dedication: { label: "Baby dedication", heading: "Certificate of Dedication", scripture: "I prayed for this child, and the Lord has granted me what I asked of him. So now I give him to the Lord. — 1 Samuel 1:27–28" },
  membership: { label: "Membership", heading: "Certificate of Membership", scripture: "So in Christ we, though many, form one body, and each member belongs to all the others. — Romans 12:5" },
  course: { label: "Course completion", heading: "Certificate of Completion", scripture: "Study to shew thyself approved unto God, a workman that needeth not to be ashamed. — 2 Timothy 2:15" },
};

export interface CertificateText {
  kind: CertificateKind;
  recipient: string;
  church: string;
  courseName?: string | null;
  parents?: string | null;
}

/** The sentence under the name, e.g. "was baptised in the name of …". */
export function certificateLine(c: CertificateText): string {
  switch (c.kind) {
    case "baptism":
      return "was baptised in the name of the Father, and of the Son, and of the Holy Spirit";
    case "dedication":
      return c.parents ? `was dedicated to the Lord by their parents, ${c.parents}` : "was dedicated to the Lord";
    case "membership":
      return `has been welcomed as a member of ${c.church}`;
    case "course":
      return `has successfully completed ${c.courseName ?? "the course"}`;
  }
}

export const certificateNumber = (no: number | string) => `No. ${no}`;
