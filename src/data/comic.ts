export type ComicBeat =
  | { kind: "thought"; text: string }
  | { kind: "speech"; speaker: string; text: string };

export type ComicPanel = {
  id: string;
  image: string;
  alt: string;
  beats: ComicBeat[];
};

export const chapterOne = {
  slug: "what-i-am",
  code: "01",
  title: "What I Am",
  when: "Present day, 2026",
  dek: "Seventeen years after he came back changed. He is still moving.",
  cover: "/comic/01-wreck.jpg",
  panels: [
    {
      id: "wreck",
      image: "/comic/01-wreck.jpg",
      alt: "A furred bat in a torn orange foam cape crawls out of smoldering wreckage.",
      beats: [
        { kind: "thought", text: "Groaning….." },
        { kind: "thought", text: "When am I going to learn…?" },
        { kind: "thought", text: "Think I broke my arm" },
      ],
    },
    {
      id: "metal",
      image: "/comic/01-metal.jpg",
      alt: "The bat hurls a slab of twisted metal into a concrete wall.",
      beats: [
        { kind: "thought", text: "So much for being unbreakable" },
        { kind: "thought", text: "What! Is that blood? Ok that really pisses me off" },
      ],
    },
    {
      id: "factory",
      image: "/comic/01-factory.jpg",
      alt: "Women flee a factory gate while the bat stands by the wreck.",
      beats: [
        { kind: "thought", text: "Come on, just let one of those women scream it’s a monster!" },
        { kind: "thought", text: "Why do I even care what happens to them" },
        { kind: "thought", text: "There’s no way I’m going to get there in this shape" },
      ],
    },
    {
      id: "overpass",
      image: "/comic/01-overpass.jpg",
      alt: "From an overpass, the bat watches trucks pass on a night highway.",
      beats: [
        { kind: "thought", text: "I need to catch a ride to the airport" },
        { kind: "thought", text: "There’s it is now, I just hope I can hold on" },
      ],
    },
    {
      id: "truck",
      image: "/comic/01-truck.jpg",
      alt: "The bat clings to the roof of a moving truck, foam cape tearing.",
      beats: [
        { kind: "thought", text: "Maybe I should just go to the hospital" },
        { kind: "thought", text: "Yea that’ll go real well" },
        { kind: "speech", speaker: "A clerk, in his head", text: "So how did you break this?" },
        {
          kind: "thought",
          text: "Oh, well I was saving mankind from utter destruction and the bad guy hit me with a light pole",
        },
        { kind: "thought", text: "Yea, like I said, real well" },
        { kind: "thought", text: "Ok, time to switch rides" },
        { kind: "thought", text: "Come on buddy, just a little closer" },
        { kind: "thought", text: "At least I’m making good time, damn this hurts" },
        { kind: "thought", text: "Look at that, must be my lucky day, a bonded truck" },
      ],
    },
    {
      id: "bags",
      image: "/comic/01-bags.jpg",
      alt: "The bat hides among airport luggage. One bag has a flamingo on it.",
      beats: [
        { kind: "thought", text: "There’s the airport lights," },
        { kind: "thought", text: "Should be no problem catching a flight" },
        { kind: "thought", text: "Ok, now I just need to find my flight" },
        { kind: "thought", text: "Lets see what we have here, Vegas! Yea, now that would make me feel better!" },
        {
          kind: "thought",
          text: "France! Oh please Mr. bad guy, don’t hurt anybody, if you like well surrender.",
        },
        { kind: "thought", text: "Maine, aaah, Live free or die. Maybe latter" },
        { kind: "thought", text: "Texas, New York, Ohio, come on" },
        { kind: "thought", text: "That’s it, Miami, close enough." },
      ],
    },
    {
      id: "hold",
      image: "/comic/01-hold.jpg",
      alt: "The bat curls into a dark corner of a plane’s cargo hold.",
      beats: [
        { kind: "thought", text: "Ah, looks like nice flying weather" },
        { kind: "thought", text: "747, yea, wonder what their serving for dinner in first class" },
        { kind: "thought", text: "ahh, that big chair, I could really stretch out" },
        { kind: "thought", text: "maybe the baggage hold instead, better class of people down there" },
        { kind: "thought", text: "there’s the spot, nice and comfy." },
        { kind: "thought", text: "look at me, bleeding, broken, hiding out in a cargo hold." },
      ],
    },
    {
      id: "engine",
      image: "/comic/01-engine.jpg",
      alt: "A jet engine burns orange as the plane leaves the runway.",
      beats: [
        { kind: "thought", text: "I knew I should have gone into show biz instead" },
        { kind: "thought", text: "All I’d have to do then is pretend to be hero." },
        { kind: "thought", text: "does my hair need more gel?" },
        { kind: "thought", text: "what’s my motivation again?" },
        { kind: "thought", text: "are you sure I won’t get hurt?" },
        { kind: "thought", text: "wait, this line looks like it might offend someone" },
        { kind: "thought", text: "yeah, lets not offend the bad guys" },
        { kind: "thought", text: "become an actor and world peace is at your fingertips" },
        { kind: "thought", text: "just as long as it doesn’t interfere with their latte" },
      ],
    },
    {
      id: "alley",
      image: "/comic/01-alley.jpg",
      alt: "In an alley, a man holds out a wallet with a family photo while another man holds a gun.",
      beats: [
        { kind: "thought", text: "look at them down there" },
        {
          kind: "thought",
          text: "they think our enemies will embrace us if we just take the time to understand them",
        },
        { kind: "thought", text: "if we just show them that we care" },
        { kind: "speech", speaker: "The man", text: "please take the money, I have a family" },
        { kind: "thought", text: "change our policies" },
        { kind: "thought", text: "pull our soldiers back" },
        { kind: "thought", text: "respect their religion" },
        { kind: "thought", text: "become sheep waiting for the slaughter" },
        { kind: "thought", text: "funny, what’s their excuse for our own" },
        { kind: "thought", text: "they are predators and predators don’t change their diets" },
        { kind: "thought", text: "we can’t save them all" },
        { kind: "thought", text: "but we can certainly kill them all" },
      ],
    },
    {
      id: "face",
      image: "/comic/01-face.jpg",
      alt: "Close on the bat’s face in the dark cargo hold, tired and furious.",
      beats: [
        { kind: "thought", text: "I need to get some sleep, big day tomorrow" },
        {
          kind: "thought",
          text: "I don’t know what’s worse. What I am. Or knowing what I am.",
        },
      ],
    },
  ] satisfies ComicPanel[],
};

export const issueTwo = {
  code: "02",
  title: "Miami",
  note: "On the pad. Next episode, next issue.",
};
