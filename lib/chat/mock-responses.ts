interface MockReply {
  keywords: string[];
  text: string;
}

const replies: MockReply[] = [
  {
    keywords: ["interaction", "interact", "together", "combine", "warfarin"],
    text: "That pairing needs care. Warfarin and NSAIDs such as ibuprofen both increase bleeding risk, so combining them raises the chance of gastrointestinal bleeding and can push the INR up. I'd suggest paracetamol as a first-line analgesic instead, and if an NSAID is truly unavoidable, the lowest dose for the shortest course with gastroprotection. Please confirm with the prescriber before changing anything, and recheck the INR within 3 to 5 days.",
  },
  {
    keywords: ["dose", "dosage", "how much", "mg", "amoxicillin"],
    text: "For an uncomplicated infection in an adult with normal renal function, amoxicillin is usually 500 mg every 8 hours, or 875 mg twice daily, for 5 to 7 days. In renal impairment (eGFR below 30) drop to 250 to 500 mg every 8 hours, and band children by weight at 40 to 45 mg/kg/day split into two or three doses. Always cross-check local guidelines and the patient's allergy history before prescribing.",
  },
  {
    keywords: ["side effect", "adverse", "metformin", "reaction"],
    text: "The common ones are gastrointestinal: nausea, diarrhea and abdominal discomfort, mostly early on and usually self-limiting. Taking it with food helps a lot. Longer term, keep an eye on vitamin B12, and be alert for lactic acidosis if renal function drops or the patient becomes hypoxic. If diarrhea turns severe or bloody, think Clostridioides difficile and stop the drug.",
  },
  {
    keywords: ["pregnan", "breastfeed", "lactation", "paracetamol", "safe"],
    text: "It depends on the trimester and the specific molecule. As a rule of thumb, paracetamol is the analgesic of choice at the lowest effective dose, while NSAIDs are avoided after 20 weeks because of effects on fetal renal function and the ductus arteriosus. Tell me the exact drug and dose and I'll walk you through the evidence and the alternatives.",
  },
];

const fallback =
  "Thanks for the question. Here is how I'd approach it: first pin down the full medication list including OTC products and supplements, then check renal and hepatic function, and finally review the indication, dose and duration. Share the patient's age, renal function and current medicines, and I'll turn this into a specific recommendation.";

export function mockReply(prompt: string): string {
  const normalized = prompt.toLowerCase();
  const match = replies.find((reply) =>
    reply.keywords.some((keyword) => normalized.includes(keyword))
  );
  return match ? match.text : fallback;
}
