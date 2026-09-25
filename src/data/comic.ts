export type ComicSpeech = { speaker?: string; text: string; place?: "top" | "lower-left" | "bottom" };

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
      image: "/comic/01-flee.jpg",
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
      image: "/comic/01-look.jpg",
      alt: "He watches a blank highway sign from the truck roof.",
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
      speech: { text: "So how did you break this?", place: "lower-left" },
    },
    {
      id: "pole",
      image: "/comic/01-reply.jpg",
      alt: "The same daydream: the bat answers the doctor.",
      thoughts: [],
      speech: {
        text: "Oh, well I was saving mankind from utter destruction and the bad guy hit me with a light pole",
        place: "bottom",
      },
    },
    {
      id: "realwell",
      image: "/comic/01-realwell.jpg",
      alt: "The truck pulls away down the empty highway.",
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
      image: "/comic/01-lane.jpg",
      alt: "The bat leaps between two trucks.",
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
      image: "/comic/01-security.jpg",
      alt: "The truck stops at an airport checkpoint.",
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
      image: "/comic/01-france.jpg",
      alt: "A fancier suitcase in the baggage room.",
      thoughts: [
        "France! Oh please Mr. bad guy, don’t hurt anybody, if you like well surrender.",
      ],
    },
    {
      id: "maine",
      image: "/comic/01-maine.jpg",
      alt: "Another line of bags, one cold and pine-colored.",
      thoughts: [
        "Maine, aaah, Live free or die. Maybe latter",
      ],
    },
    {
      id: "states",
      image: "/comic/01-states.jpg",
      alt: "A long row of suitcases rolling past.",
      thoughts: [
        "Texas, New York, Ohio, come on",
      ],
    },
    {
      id: "miami",
      image: "/comic/01-miami.jpg",
      alt: "A flamingo sticker on a bag.",
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
      image: "/comic/01-dinner.jpg",
      alt: "A closer look at the 747 at the gate.",
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
      image: "/comic/01-board.jpg",
      alt: "Passengers boarding, seen through the ramp windows.",
      thoughts: [
        "maybe the baggage hold instead, better class of people down there",
      ],
    },
    {
      id: "comfy",
      image: "/comic/01-hold.jpg",
      alt: "Inside the cargo hold. The door is shut. He looks through a small window.",
      thoughts: [
        "there’s the spot, nice and comfy.",
      ],
    },
    {
      id: "bleeding",
      image: "/comic/01-bleed.jpg",
      alt: "The cargo door stays shut. He looks out a small window, bleeding.",
      thoughts: [
        "look at me, bleeding, broken, hiding out in a cargo hold.",
      ],
    },
    {
      id: "showbiz",
      image: "/comic/01-showbiz.jpg",
      alt: "He tears the foam cape inside the closed hold, watching through the window.",
      thoughts: [
        "I knew I should have gone into show biz instead",
      ],
    },
    {
      id: "pretend",
      image: "/comic/01-taxi.jpg",
      alt: "The 747 taxis.",
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
      image: "/comic/01-hot.jpg",
      alt: "The engine nozzle glows hotter.",
      thoughts: [
        "are you sure I won’t get hurt?",
        "wait, this line looks like it might offend someone",
      ],
    },
    {
      id: "offend",
      image: "/comic/01-thrust.jpg",
      alt: "The 747 rotates off the runway.",
      thoughts: [
        "yeah, lets not offend the bad guys",
      ],
    },
    {
      id: "peace",
      image: "/comic/01-air.jpg",
      alt: "The 747 is airborne.",
      thoughts: [
        "become an actor and world peace is at your fingertips",
      ],
    },
    {
      id: "latte",
      image: "/comic/01-latte.jpg",
      alt: "In the closed hold, he looks through the small window at the city.",
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
      image: "/comic/01-blocks.jpg",
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
      image: "/comic/01-gun.jpg",
      alt: "The gunman takes the money.",
      thoughts: [
        "change our policies",
        "pull our soldiers back",
      ],
    },
    {
      id: "religion",
      image: "/comic/01-eyes.jpg",
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
      image: "/comic/01-follow.jpg",
      alt: "He follows the robber from above.",
      thoughts: [
        "they are predators and predators don’t change their diets",
      ],
    },
    {
      id: "save",
      image: "/comic/01-breath.jpg",
      alt: "The victim's last breath.",
      thoughts: [
        "we can’t save them all",
      ],
    },
    {
      id: "kill",
      image: "/comic/01-name.jpg",
      alt: "The wallet, with no readable name.",
      thoughts: [
        "but we can certainly kill them all",
      ],
    },
    {
      id: "sleep",
      image: "/comic/01-sleep.jpg",
      alt: "He falls asleep in the closed hold, the small window still lit.",
      thoughts: [
        "I need to get some sleep, big day tomorrow",
      ],
    },
    {
      id: "what",
      image: "/comic/01-what.jpg",
      alt: "Close on his face. The cargo door is shut behind him, a small window glowing.",
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
