export type ComicSpeech = { speaker: string; text: string };

export type ComicPanel = {
  id: string;
  image: string;
  alt: string;
  thoughts: string[];
  speech?: ComicSpeech;
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
      id: "groan",
      image: "/comic/01-wreck.jpg",
      alt: "The bat crawls out of smoldering wreckage.",
      thoughts: [
        "Groaning…..",
      ],
    },
    {
      id: "learn",
      image: "/comic/01-arm.jpg",
      alt: "Close on the bat under twisted metal.",
      thoughts: [
        "When am I going to learn…?",
        "Think I broke my arm",
      ],
    },
    {
      id: "metal",
      image: "/comic/01-metal.jpg",
      alt: "The bat hurls twisted metal into a concrete wall.",
      thoughts: [
        "So much for being unbreakable",
      ],
    },
    {
      id: "blood",
      image: "/comic/01-blood.jpg",
      alt: "A blood trail leads back to the wreckage.",
      thoughts: [
        "What! Is that blood? Ok that really pisses me off",
      ],
    },
    {
      id: "factory",
      image: "/comic/01-factory.jpg",
      alt: "Women outside a factory see the wreck.",
      thoughts: [
        "Come on, just let one of those women scream it’s a monster!",
      ],
    },
    {
      id: "flee",
      image: "/comic/01-factory.jpg",
      alt: "The women flee and offer no help.",
      thoughts: [
        "Why do I even care what happens to them",
      ],
    },
    {
      id: "limp",
      image: "/comic/01-limp.jpg",
      alt: "The bat limps toward an overpass.",
      thoughts: [
        "There’s no way I’m going to get there in this shape",
      ],
    },
    {
      id: "highway",
      image: "/comic/01-overpass.jpg",
      alt: "Night highway seen from above.",
      thoughts: [
        "I need to catch a ride to the airport",
      ],
    },
    {
      id: "bridge",
      image: "/comic/01-bridge.jpg",
      alt: "A truck passes under the bridge.",
      thoughts: [
        "There’s it is now, I just hope I can hold on",
      ],
    },
    {
      id: "hospital",
      image: "/comic/01-truck.jpg",
      alt: "The bat clings to a moving truck.",
      thoughts: [
        "Maybe I should just go to the hospital",
        "Yea that’ll go real well",
      ],
    },
    {
      id: "look",
      image: "/comic/01-truck.jpg",
      alt: "The truck moves down the highway.",
      thoughts: [
        "Say they get past how I look",
      ],
    },
    {
      id: "clerk",
      image: "/comic/01-clerk.jpg",
      alt: "A daydream: the bat at a doctor's office with a broken arm.",
      thoughts: [
      ],
      speech: { speaker: "A clerk, in his head", text: "So how did you break this?" },
    },
    {
      id: "pole",
      image: "/comic/01-truck.jpg",
      alt: "The bat rides the truck, rehearsing an answer.",
      thoughts: [
        "Oh, well I was saving mankind from utter destruction and the bad guy hit me with a light pole",
      ],
    },
    {
      id: "realwell",
      image: "/comic/01-truck.jpg",
      alt: "The truck keeps moving.",
      thoughts: [
        "Yea, like I said, real well",
      ],
    },
    {
      id: "switch",
      image: "/comic/01-leap.jpg",
      alt: "Another truck draws alongside.",
      thoughts: [
        "Ok, time to switch rides",
        "Come on buddy, just a little closer",
      ],
    },
    {
      id: "lane",
      image: "/comic/01-leap.jpg",
      alt: "The bat leaps to the truck in the next lane.",
      thoughts: [
        "At least I’m making good time, damn this hurts",
      ],
    },
    {
      id: "bonded",
      image: "/comic/01-bonded.jpg",
      alt: "Numbers stenciled on the truck roof.",
      thoughts: [
        "Look at that, must be my lucky day, a bonded truck",
      ],
    },
    {
      id: "lights",
      image: "/comic/01-airport.jpg",
      alt: "Airport lights ahead.",
      thoughts: [
        "There’s the airport lights,",
        "Should be no problem catching a flight",
      ],
    },
    {
      id: "security",
      image: "/comic/01-bags.jpg",
      alt: "The bat in the baggage area.",
      thoughts: [
        "Ok, now I just need to find my flight",
      ],
    },
    {
      id: "vegas",
      image: "/comic/01-bags.jpg",
      alt: "Luggage tags, including a Vegas bag.",
      thoughts: [
        "Lets see what we have here, Vegas! Yea, now that would make me feel better!",
      ],
    },
    {
      id: "france",
      image: "/comic/01-bags.jpg",
      alt: "Another line of bags.",
      thoughts: [
        "France! Oh please Mr. bad guy, don’t hurt anybody, if you like well surrender.",
      ],
    },
    {
      id: "maine",
      image: "/comic/01-bags.jpg",
      alt: "Another line of baggage.",
      thoughts: [
        "Maine, aaah, Live free or die. Maybe latter",
      ],
    },
    {
      id: "states",
      image: "/comic/01-bags.jpg",
      alt: "More baggage rolling past.",
      thoughts: [
        "Texas, New York, Ohio, come on",
      ],
    },
    {
      id: "miami",
      image: "/comic/01-bags.jpg",
      alt: "A flamingo on a bag.",
      thoughts: [
        "That’s it, Miami, close enough.",
      ],
    },
    {
      id: "weather",
      image: "/comic/01-gate.jpg",
      alt: "The bat on a baggage cart at the plane.",
      thoughts: [
        "Ah, looks like nice flying weather",
      ],
    },
    {
      id: "dinner",
      image: "/comic/01-gate.jpg",
      alt: "A 747 at the gate.",
      thoughts: [
        "747, yea, wonder what their serving for dinner in first class",
      ],
    },
    {
      id: "chair",
      image: "/comic/01-jetway.jpg",
      alt: "The boarding ramp door.",
      thoughts: [
        "ahh, that big chair, I could really stretch out",
      ],
    },
    {
      id: "holdinstead",
      image: "/comic/01-jetway.jpg",
      alt: "Passengers boarding, seen through the ramp windows.",
      thoughts: [
        "maybe the baggage hold instead, better class of people down there",
      ],
    },
    {
      id: "comfy",
      image: "/comic/01-hold.jpg",
      alt: "A dark corner of the cargo hold.",
      thoughts: [
        "there’s the spot, nice and comfy.",
      ],
    },
    {
      id: "bleeding",
      image: "/comic/01-door.jpg",
      alt: "The cargo door closes.",
      thoughts: [
        "look at me, bleeding, broken, hiding out in a cargo hold.",
      ],
    },
    {
      id: "showbiz",
      image: "/comic/01-hold.jpg",
      alt: "Cloth rips in the dim hold.",
      thoughts: [
        "I knew I should have gone into show biz instead",
      ],
    },
    {
      id: "pretend",
      image: "/comic/01-engine.jpg",
      alt: "The plane taxis.",
      thoughts: [
        "All I’d have to do then is pretend to be hero.",
      ],
    },
    {
      id: "gel",
      image: "/comic/01-engine.jpg",
      alt: "The plane heads down the runway.",
      thoughts: [
        "does my hair need more gel?",
        "what’s my motivation again?",
      ],
    },
    {
      id: "hurt",
      image: "/comic/01-engine.jpg",
      alt: "The engine burns.",
      thoughts: [
        "are you sure I won’t get hurt?",
        "wait, this line looks like it might offend someone",
      ],
    },
    {
      id: "offend",
      image: "/comic/01-engine.jpg",
      alt: "The engine at full thrust.",
      thoughts: [
        "yeah, lets not offend the bad guys",
      ],
    },
    {
      id: "peace",
      image: "/comic/01-engine.jpg",
      alt: "The plane lifts off.",
      thoughts: [
        "become an actor and world peace is at your fingertips",
      ],
    },
    {
      id: "latte",
      image: "/comic/01-face.jpg",
      alt: "The cargo hold in the dark.",
      thoughts: [
        "just as long as it doesn’t interfere with their latte",
      ],
    },
    {
      id: "downthere",
      image: "/comic/01-city.jpg",
      alt: "The city, seen through the hull.",
      thoughts: [
        "look at them down there",
      ],
    },
    {
      id: "enemies",
      image: "/comic/01-city.jpg",
      alt: "Ten city blocks at night.",
      thoughts: [
        "they think our enemies will embrace us if we just take the time to understand them",
      ],
    },
    {
      id: "care",
      image: "/comic/01-alley.jpg",
      alt: "Two men in an alley, one with a gun.",
      thoughts: [
        "if we just show them that we care",
      ],
    },
    {
      id: "family",
      image: "/comic/01-wallet.jpg",
      alt: "A wallet, cash, and a family photo.",
      thoughts: [
      ],
      speech: { speaker: "The man", text: "please take the money, I have a family" },
    },
    {
      id: "policies",
      image: "/comic/01-wallet.jpg",
      alt: "Bills pulled from the wallet.",
      thoughts: [
        "change our policies",
        "pull our soldiers back",
      ],
    },
    {
      id: "religion",
      image: "/comic/01-alley.jpg",
      alt: "The victim's eyes.",
      thoughts: [
        "respect their religion",
      ],
    },
    {
      id: "sheep",
      image: "/comic/01-ground.jpg",
      alt: "The victim on the ground, blood on the family photo.",
      thoughts: [
        "become sheep waiting for the slaughter",
      ],
    },
    {
      id: "excuse",
      image: "/comic/01-walk.jpg",
      alt: "The murderer walks into the light.",
      thoughts: [
        "funny, what’s their excuse for our own",
      ],
    },
    {
      id: "predators",
      image: "/comic/01-walk.jpg",
      alt: "He follows the robber.",
      thoughts: [
        "they are predators and predators don’t change their diets",
      ],
    },
    {
      id: "save",
      image: "/comic/01-ground.jpg",
      alt: "The victim's last breath.",
      thoughts: [
        "we can’t save them all",
      ],
    },
    {
      id: "kill",
      image: "/comic/01-walk.jpg",
      alt: "A name and address in the wallet.",
      thoughts: [
        "but we can certainly kill them all",
      ],
    },
    {
      id: "sleep",
      image: "/comic/01-face.jpg",
      alt: "The bat in the hold.",
      thoughts: [
        "I need to get some sleep, big day tomorrow",
      ],
    },
    {
      id: "what",
      image: "/comic/01-face.jpg",
      alt: "Close on the bat.",
      thoughts: [
        "I don’t know what’s worse, what I am or knowing what I am",
      ],
    },
  ] satisfies ComicPanel[],
};

export const issueTwo = {
  code: "02",
  title: "Miami",
  note: "On the pad. Next episode, next issue.",
};
