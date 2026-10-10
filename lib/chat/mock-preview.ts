import type { Message } from "./types";

/**
 * Stand-in conversation previews for the history list. Once the backend is
 * connected, replace with `getChatMessages(id)` — the preview dialog only needs
 * an array of messages, nothing else.
 */
const previews: Record<string, Message[]> = {
  "1": [
    {
      id: "m1-user",
      role: "user",
      content: "My left eye has been red and watery since yesterday, and it hurts in bright light.",
    },
    {
      id: "m1-assistant",
      role: "assistant",
      content: "Sorry to hear that. Watery, light-sensitive eyes with redness are most often **viral conjunctivitis**, especially if it started in one eye and there's no thick discharge. Let's narrow it down:\n\n- Is there sticky yellow-green discharge, or mostly clear tearing?\n- Any crusting on the lashes in the morning?\n- Do you wear contact lenses?\n- Any recent cold, or someone around you with a red eye?\n\nIn the meantime, cool compresses and preservative-free lubricating drops help, and avoid touching the other eye. **Please get seen today if vision drops, pain worsens, or you wear lenses** — those are the red flags.",
    },
    {
      id: "m1-user-2",
      role: "user",
      content: "Mostly clear tearing, some crusting in the morning. No contacts.",
    },
    {
      id: "m1-assistant-2",
      role: "assistant",
      content: "That pattern fits a mild viral or allergic conjunctivitis. Since there's no contact lens wear and no thick discharge, it's reasonable to manage at home for 48 hours: cool compresses 3-4 times a day, lubricating drops, and strict hand hygiene. If it isn't improving in two days, or the discharge turns thick and yellow-green, that points to a bacterial cause and needs antibiotic drops — see an eye clinic at that point.",
    },
  ],
  "2": [
    {
      id: "m2-user",
      role: "user",
      content: "Cramping stomach pain after dinner for the last three nights. No vomiting, appetite is fine.",
    },
    {
      id: "m2-assistant",
      role: "assistant",
      content: "Three days of post-meal cramping with a normal appetite is usually benign. A few questions:\n\n- Is it related to fatty or spicy meals?\n- Any change in bowel habit, bloating, or reflux?\n- Any NSAID use, alcohol, or new medication?\n\nSmaller meals, less fat and spice, and avoiding late eating usually settle it within a week.",
    },
  ],
  "3": [
    {
      id: "m3-user",
      role: "user",
      content: "Tension headache behind my eyes every afternoon at work. Screen time is about 9 hours.",
    },
    {
      id: "m3-assistant",
      role: "assistant",
      content: "With nine hours of screen time, this is classic **eye-strain / tension-type headache**. The 20-20-20 rule is the single highest-yield fix: every 20 minutes, look 20 feet away for 20 seconds. Also raise your monitor so the top of the screen sits at eye level, and get your refraction checked if it's been over two years. An occasional paracetamol is fine, but taking painkillers more than two days a week can itself cause rebound headaches.",
    },
  ],
  "4": [
    {
      id: "m4-user",
      role: "user",
      content: "Lower back has been stiff for a week, worse after sitting all day. No leg pain or numbness.",
    },
    {
      id: "m4-assistant",
      role: "assistant",
      content: "A week of stiffness without leg pain, numbness, or weakness is almost always mechanical and improves with movement. Stay active, avoid bed rest, and use heat before activity. Red flags that need urgent review: leg weakness, numbness around the saddle area, bladder or bowel changes, fever, or unexplained weight loss — none of which you've mentioned.",
    },
  ],
  "5": [
    {
      id: "m5-user",
      role: "user",
      content: "Right knee swells and aches after gym sessions. I play basketball twice a week.",
    },
    {
      id: "m5-assistant",
      role: "assistant",
      content: "Post-exercise swelling in a knee is commonly a meniscal irritation or patellar overload. Rest from jumping for two weeks, ice 15 minutes after activity, and start quad strengthening — straight leg raises and slow squats. If it locks, gives way, or swells repeatedly, get an MRI. Proper landing mechanics and hip strength do a lot for prevention in basketball.",
    },
  ],
};

const empty: Message[] = [];

export function getMockPreview(chatId: string): Message[] {
  return previews[chatId] ?? empty;
}
