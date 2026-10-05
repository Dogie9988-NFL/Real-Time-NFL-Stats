
// =========================================================
//   STORY EVENTS (module: story-events)
//   20 new random events, 5 of them with a playable moment,
//   4 callback events that pay off earlier choices, a trick
//   play that can pay off in a real game, epilogue lines,
//   3 trophies and 2 items. Random events also show up in
//   two more weeks (3 and 6) when those weeks aren't crowded.
//
//   Extra (optional) fields an EVENTS entry can carry here:
//     tag: 'fun'|'heart'|'tempt'|'football'|'rookie'|'fan'|'callback'  (chip icon)
//     label: 'Fan Fest'                    (chip text)
//     from: 'coin'                         (callback events: the event they pay off)
//     html: () => string                   (extra card drawn under the story text)
//     play: { title, type, diff, label, prompt, btn, fakes, setup, read, done(r, x) }
//           (a playable moment, reached with then: evPlay('key'))
//   Everything else is the normal EVENTS shape, so P.event renders these unchanged.
// =========================================================
const EV = {
  st() { return ext('story-events', () => ({ seen: {} })); },
  year() { return (S && S.year) || 1; },
  y1() { return EV.year() === 1; },
  // True once event k has been shown in an EARLIER week (or an earlier season).
  seenBefore(k) {
    const s = EV.st().seen[k];
    return !!s && (s.y < EV.year() || s.n < S.slate);
  },
  rostered() { return ['backup', 'rotation', 'starter'].includes(S.role); },
  byPos(o) { return o[S.pos] || o.QB; },
  coinOut() {
    if (!S.flags.ev_coinOut) { S.flags.ev_coinOut = chance(0.35) ? 'moon' : 'crash'; save(); }
    return S.flags.ev_coinOut;
  },
};
const evPlay = e => ({ id: 'ev_mini', args: { e } });

// The trick play you draw on a napkin, per position.
const EV_TRICK = {
  QB: { name: 'The Boomerang', desc: `You hand it off, the running back flips it straight back to you, and you throw deep while the whole defense is busy tackling a guy without the ball.`,
    run: `The handoff, the flip back, the throw. The safety bites so hard on the fake that he ends up in the backfield. Your receiver is alone by twenty yards.` },
  RB: { name: 'The Halfback Heave', desc: `You take the pitch and sprint right like it's a sweep. Then you stop, plant, and throw it to the tight end, who has been pretending to block for four whole seconds.`,
    run: `You take the pitch, sell the sweep, stop on a dime, and float it to the tight end. He catches it so wide open that he looks around to make sure it's legal.` },
  WR: { name: 'The Reverse Pass', desc: `You take a reverse and sprint across the field. Then you stop and throw it back to the quarterback, who has been standing alone on the other side, forgotten by everyone.`,
    run: `You take the reverse, the whole defense flows with you, and you throw it back across the field to a quarterback who is so open he has time to wave.` },
  LB: { name: 'The Shark Tank', desc: `You show blitz, scream like you're coming, then drop straight back into the passing lane, right where the quarterback was planning to throw.`,
    run: `You creep up, you scream, you drop. The quarterback throws it right into your chest and looks genuinely hurt about it.` },
};

// The film-room tiebreaker, per position (a 'read' mini-game).
const EV_FILM = {
  QB: { clip: `Third and seven. Before the snap, one safety sits deep in the middle. At the snap, the cornerback on the left turns and runs with the receiver. Bramble says it's man-to-man. Okafor says it's zone.`,
    read: { q: 'What is the defense really doing?', tell: 'Watch the cornerback\'s eyes. In man coverage he stares at his receiver. In zone he stares at the quarterback.',
      opts: [
        ['He\'s watching the quarterback, not the receiver. It\'s zone, dressed up as man.', 'great', 'You freeze the frame on the cornerback\'s eyes. They\'re locked on the quarterback the whole way. Okafor says "Ha." Bramble stares at the screen for a long time.'],
        ['It\'s man. The corner turned and ran with his guy.', 'good', 'Half right. He did run with him. Then Okafor freezes the frame on his eyes and shows you where he was really looking. Bramble nods anyway. "Good enough to argue with."'],
        ['It\'s Cover 2. Two safeties, splitting the deep field.', 'bad', 'Bramble rewinds it and counts the deep safeties out loud. "One." He holds up one finger and keeps it there for a really long time.'],
      ] } },
  RB: { clip: `An inside zone run. The play is designed to go right. At the handoff, the backside linebacker sprints hard to the right with everybody else. Bramble says the back should bounce it outside. Okafor says cut it back.`,
    read: { q: 'Where should the running back go?', tell: 'Watch the backside linebacker. If he chases the play, the cutback lane behind him is wide open.',
      opts: [
        ['Cut it back. The backside linebacker ran himself right out of the play.', 'great', 'You rewind and point at the empty grass behind the linebacker. There\'s enough room back there to park a bus. Okafor taps the screen twice. Bramble writes something down.'],
        ['Bounce it outside. There\'s room on the edge.', 'good', 'There is room on the edge, for about four yards. Then the safety arrives. Bramble says "Four yards is four yards." Okafor shows you the cutback lane anyway.'],
        ['Stay on the design. Follow the blockers to the right.', 'bad', 'You\'d run straight into the linebacker who sprinted over there, plus five of his friends. Bramble pauses the tape on the pile. "The design," he says, "is a suggestion." Okafor writes that down to use against him later.'],
      ] } },
  WR: { clip: `Press coverage on the outside. The cornerback lines up nose to nose with the receiver, shaded a half-step to the inside. Bramble says run the slant. Okafor says run the fade.`,
    read: { q: 'Which route beats this cornerback?', tell: 'Check where the cornerback lines up. If he\'s shaded to the inside, he\'s taking away the slant. Win outside.',
      opts: [
        ['He\'s shaded inside. Run the fade and win at the sideline.', 'great', 'You freeze it at the snap and draw a line on the screen. The whole outside is empty. Okafor folds her arms and looks at Bramble. Bramble looks at the ceiling.'],
        ['The slant. Get the ball out quick before he can react.', 'good', 'Quick and safe. You\'d probably get five yards. Okafor shows you the fade and how much more was there. "Probably" is not her favorite word.'],
        ['Stutter at the line, then run the slant anyway.', 'bad', 'Right into the spot he\'s guarding. Bramble rewinds it and lets you watch the cornerback jump that slant, in slow motion, three times.'],
      ] } },
  LB: { clip: `The offense breaks the huddle. The right guard settles into his stance with a lot of weight on his down hand. His knuckles are white. Bramble says it's a run. Okafor says it's a pass.`,
    read: { q: 'Run or pass?', tell: 'Look at the guard\'s hand. Heavy weight on the knuckles means he\'s about to fire forward. That\'s a run.',
      opts: [
        ['Run. All his weight is on his knuckles. He\'s about to fire out.', 'great', 'You freeze the frame on the guard\'s hand and zoom in on his white knuckles. The next frame, he fires straight ahead. Run play. Bramble grunts, which is how he says "correct."'],
        ['Pass. The quarterback is in the shotgun.', 'good', 'Reasonable. Teams pass out of the shotgun a lot. Not this time. Okafor shows you the guard\'s hand, and you can\'t believe you missed it.'],
        ['Screen pass. The running back is cheating wide.', 'bad', 'The running back is not cheating anywhere. He takes the handoff and runs straight into the line, the least tricky play in football. Okafor taps the screen: "The hand, {last}. Always the hand."'],
      ] } },
};

Object.assign(EVENTS, {
  // ---------------- Funny ----------------
  chompers: { tag: 'fun', label: 'Fan Fest', title: 'Inside the Shark',
    body: [
      `Fan Fest at the stadium. Face paint, a bounce house shaped like a helmet, and four thousand kids on a sugar high.`,
      `The main event is the Chompers Dance-Off. Chompers is the team mascot, a seven-foot foam hammerhead with googly eyes. Ten minutes before showtime, the student who wears the suit rolls his ankle on a pile of foam fingers.`,
      `The suit is lying on a folding table. Its head is staring at you.`],
    choices: [
      { label: `Put on the suit. The show must go on.`, sub: 'Playable moment', then: evPlay('chompers') },
      { label: `Volunteer Tiny.`, do() { fx({ chem: 6, fame: 2 }); return [`Tiny gets one leg into the suit before the zipper gives up. He performs in just the head and his own gym shorts. The kids lose their minds. Chompers has never been more popular.`]; } },
      { label: `Keep signing autographs.`, do() { fx({ fame: 3, energy: -3 }); return [`You sign four hundred foam fingers. Behind you, a backup mascot in a lobster costume does the worm for eleven straight minutes. Nobody knows why there's a lobster.`]; } },
    ],
    play: { title: 'The Chompers Dance-Off', type: 'combo', diff: 1.6, label: 'Dance-off', prompt: 'Hit the dance steps in order. Big fins. Bigger energy.',
      setup: [`The suit smells like twelve summers of hot dogs. You can see out of the mouth, mostly.`, `The drumline kicks in. Four thousand kids start chanting for a shark.`],
      titles: { great: 'Chomp Chomp', good: 'Nailed It, Mostly', bad: 'Tuba Section' },
      done(r) {
        S.flags.ev_chompers = r === 'bad' ? 'fell' : 'star';
        if (r === 'great') { fx({ fame: 4, conf: 5, chem: 3 }); return [`You hit every step. The fin wiggle. The tail spin. The move where you pretend to swim. The crowd chants *CHOMP-ERS, CHOMP-ERS.*`, `Nobody knows it's you. Somehow that makes it the best you've felt all month.`]; }
        if (r === 'good') { fx({ conf: 3, chem: 2 }); return [`You miss a step, turn it into a spin, and the kids think it's choreography. Afterward a five-year-old gives Chompers a juice box. You can't drink it through the suit. You keep it anyway.`]; }
        fx({ fame: 2, chem: 4, conf: -2 }); return [`You trip on your own tail and fall off the stage into the tuba section of the drumline. The tubas keep playing.`, `The crowd gives Chompers a standing ovation for "the stunt." Tiny, who knows the truth, laughs until he has to lie down.`];
      } } },

  chef: { tag: 'fun', label: 'Going viral', title: 'Kitchen Nightmare',
    get body() {
      const dish = { town: `Grandma Bea's famous cinnamon rolls`, city: `Mom's Sunday lasagna`, base: `Dad's mess-hall chili, scaled down from two hundred servings` }[S.origin] || `{fam}'s famous recipe`;
      return [
        `The team's charity livestream needs a cooking segment, and somebody told the producer you can cook. You cannot cook.`,
        `You promise to make ${dish}. You have the recipe on a sticky note. You own one pan.`,
        `Forty thousand people are watching live.`];
    },
    choices: [
      { label: `Cook it live. How hard can it be?`, do() {
          if (chance(0.6)) { S.flags.ev_chef = 'fire'; fx({ fame: 10, conf: -2 }); return [`At minute nine, the smoke alarm goes off. At minute eleven, the Harbor City Fire Department arrives, live on camera, in full gear.`, `A firefighter tastes what's left in the pan and gives it a six out of ten. The clip is everywhere by dinner.`]; }
          S.flags.ev_chef = 'win'; fx({ fame: 5, family: 6, conf: 3 }); return [`It works. It actually works. The chat fills up with chef hats.`, `{fam} texts you a single word: *Proud.* Then a second text: *Too much salt.*`];
        } },
      { label: `Make Tiny your sous-chef.`, do() { fx({ chem: 6, fame: 4 }); return [`Tiny takes the knife out of your hand within ninety seconds. He's incredible. He dices an onion while explaining zone blocking to forty thousand people.`, `The comments only want to talk about Tiny. Honestly, fair.`]; } },
      { label: `Order takeout and plate it like you made it.`, do() {
          if (chance(0.5)) { fx({ fame: 7, conf: -3 }); return [`Halfway through, the delivery driver walks into frame and asks you to sign the receipt. Forty thousand people watch you sign it.`, `The chat types HAHAHA in all caps for six straight minutes.`]; }
          fx({ fame: 3, family: -2 }); return [`Nobody suspects a thing. Nobody except {fam}, who calls the second the stream ends.`, { s: '{fam}', t: `That is not my recipe. I can see the takeout container behind your toaster.` }];
        } },
    ] },

  rocco: { tag: 'fun', label: 'Equipment room', title: 'The Keeper of the Cleats',
    body: [
      `Your cleats have a hole in the left toe. You can see your sock. On cold days, you can see your toe.`,
      `New cleats come from the equipment room, and the equipment room belongs to Rocco. Rocco has run it for thirty-one years. He has a ring of keys the size of a dinner plate and a laminated sign on the door that just says NO.`,
      { s: 'Rocco', t: `Form E-14. In triplicate. Three to five business days. Next.` }],
    choices: [
      { label: `Fill out Form E-14. In triplicate.`, do() { fx({ coach: 2, conf: 1 }); return [`Three copies, neat handwriting, every box checked. Five business days later, a box of new cleats appears in your locker.`, `Rocco walks past and says one word: "Legible." Tiny tells you Rocco hasn't complimented a living person since 2011.`]; } },
      { label: `Find out how Rocco takes his coffee.`, do() { S.items.tape = true; fx({ chem: 2, energy: 4 }); return [`Tiny knows. Black, four sugars, served in a 1998 Hammerheads mug that Rocco hides behind the helmet dryer.`, `You show up at 6 a.m. holding the mug. Rocco looks at it for a long time. Then he hands you new cleats, tapes your ankles like he's restoring a painting, and tells you to come back every Thursday.`, { note: `New item: Rocco's tape job. +3 Energy at the start of every week.` }]; } },
      { if: () => !!S.items.blitz, label: `Send Blitz in as an ambassador.`, do() { S.items.tape = true; fx({ conf: 3, chem: 2 }); return [`Blitz trots into the equipment room with a tennis ball and drops it at Rocco's feet. Rocco, who has said no to four head coaches, throws the ball for forty-five minutes.`, `You leave with new cleats and a standing Thursday ankle-taping appointment. Blitz leaves with a tiny pair of cleats.`, { note: `New item: Rocco's tape job. +3 Energy at the start of every week.` }]; } },
      { label: `Sneak in after hours.`, do() {
          if (chance(0.5)) {
            const L = S.last.toUpperCase(), oops = L.length > 3 ? L.slice(0, -2) + L.slice(-1) + L.slice(-2, -1) : L + 'Z';
            fx({ conf: -3, chem: 3 });
            return [`It's dark. You find the cleats. Then a desk lamp clicks on. Rocco is sitting in a chair in the corner, like he's been waiting there since 1994.`, { s: 'Rocco', t: `Form E-14.` }, `For the rest of the week, the nameplate on your locker says ${oops}. Nobody will tell you how he did it that fast.`];
          }
          fx({ conf: 2, energy: -2 }); return [`You get in and out with a brand-new pair of cleats. They're two sizes too small. You wear them anyway, because you can't exactly return them.`];
        } },
    ] },

  goose: { tag: 'fun', label: 'Practice field', title: 'Goose Week',
    body: [
      `A Canada goose has claimed the thirty-yard line of the practice field. It's large. It's angry. It hisses at anyone who comes within ten yards, including the head coach.`,
      { s: 'Coach Bramble', t: `We are not moving practice for a bird.` },
      `The goose feels the same way about moving for a football team.`],
    choices: [
      { label: `Lure it away with bread from the cafeteria.`, do() { S.flags.ev_goose = 'friend'; fx({ fame: 4, chem: 3 }); return [`It works. Too well. The goose follows you for the rest of the week: to the weight room, to the film room, to your car. It waits outside the locker room like a bodyguard.`, `Somebody makes the goose a fan account. The bio says *{first}'s security.*`]; } },
      { if: () => !!S.items.blitz, label: `Release the Blitz.`, do() { S.flags.ev_goose = 'blitz'; fx({ conf: 4, chem: 3 }); return [`Blitz sprints at the goose at full speed, skids to a stop right in front of it, and lies down. The goose sits down next to him.`, `By Wednesday they're napping together on the sideline. Nobody can explain it. Bramble doesn't try.`]; } },
      { label: `Ask Tiny to handle it.`, do() { fx({ chem: 6 }); return [`Tiny walks toward the goose with his arms spread wide, very confident. The goose charges. Tiny runs eighty yards in a time that makes the strength coach drop his stopwatch.`, { s: 'Tiny', t: `I'm not scared. I just respect nature.` }]; } },
      { label: `Practice around it.`, do() { fx({ coach: 4, skill: 1 }); return [`You run every rep with a live goose at the thirty. By Friday you don't even flinch when it hisses. In the team meeting, Bramble points at the window.`, { s: 'Coach Bramble', t: `Be like the goose. Unbothered.` }]; } },
    ] },

  punt: { tag: 'fun', label: 'Commercial shoot', if: () => S.st.fame >= 20, title: 'Lights, Camera, Punt',
    body: [
      `Harbor Slice Pizza wants you for a commercial. The idea: a machine fires a punt sixty yards into the air, you catch it with one hand, take a bite of pizza with the other, and say the slogan. One take. Live studio audience.`,
      `The slogan is "Harbor Slice: Catch the Flavor." You've said worse things on camera. Not many.`],
    choices: [
      { label: `Do the stunt yourself.`, sub: 'Playable moment · pays $20,000', then: evPlay('punt') },
      { label: `Let a stunt double catch it.`, do() { fx({ money: 12000, fame: 1 }); return [`The stunt double is five-foot-six and nails it on the first try. In the commercial, your head has been digitally added to his body. It looks like a bobblehead. It airs nine hundred times.`]; } },
      { label: `Pitch a better idea: Tiny catches the pizza.`, do() { fx({ money: 8000, fame: 4, chem: 5 }); return [`The director loves it. Tiny catches a whole pizza fired from a T-shirt cannon and eats it in one continuous shot. The commercial wins a regional award. Tiny keeps the award in his truck.`]; } },
    ],
    play: { title: 'Take One', type: 'timing', diff: 1.8, label: 'The catch', prompt: 'Fire the machine, then stop the needle in the window to make the catch.', btn: 'Catch it', startBtn: 'Fire the machine',
      setup: [`The punt machine is pointed at the studio lights. A crew member counts down from three, remembers it's live, and counts down again. Somebody in the audience whispers "oh no."`, `You have a slice of pepperoni in your other hand. Whatever happens, do not drop the pizza.`],
      titles: { great: 'One Take', good: 'Take Eleven', bad: 'The Blooper' },
      done(r) {
        if (r === 'great') { fx({ money: 20000, fame: 7, conf: 4 }); return [`One hand. The ball drops into your palm like it was mailed there. You take a bite and say the slogan with your mouth full.`, `The director yells "That's the one!" It's the first commercial in Harbor Slice history shot in a single take. They give you free pizza for life, which is a dangerous thing to give an athlete.`]; }
        if (r === 'good') { fx({ money: 20000, fame: 3, energy: -6 }); return [`You catch it on take eleven. You eat eleven slices of pizza. The commercial is great.`, `You do not want to look at pizza again until March.`]; }
        fx({ money: 20000, fame: 6, conf: -3 }); return [`The ball hits the pizza. The pizza hits your face. The audience gasps, then applauds.`, `They use the blooper. The new slogan is "Harbor Slice: It Gets Everywhere." It's their best month in company history.`];
      } } },

  sleep: { tag: 'fun', label: 'Training room', title: 'Sleep Study',
    body: [
      `Dr. Imani Shaw, the team doctor, hands every player a sleep-tracking ring. A week later she calls you into her office and turns her monitor around.`,
      { s: 'Dr. Imani Shaw', t: `You're averaging five hours and twelve minutes. There's a spike of activity at one a.m. every night. Is that a video game?` },
      `It is a video game. Tiny, for comparison, averages eleven hours. He also naps.`],
    choices: [
      { label: `Follow her plan. Lights out at ten.`, do() { S.items.sleep = true; fx({ energy: 8, coach: 2 }); return [`No screens after nine. Blackout curtains. A white-noise machine that sounds like the ocean. The first night you stare at the ceiling for two hours. By the fourth night you sleep like you got hit by a truck.`, { note: `New item: Dr. Shaw's sleep plan. +4 Energy at the start of every week.` }]; } },
      { label: `Argue that you're "a night person."`, do() { fx({ conf: 1, coach: -2 }); return [{ s: 'Dr. Imani Shaw', t: `There are no night people. There are only tired people with opinions.` }, `She prints that sentence on a sign and hangs it in the training room. Everybody knows it's about you.`]; } },
      { if: () => !!S.items.blitz, label: `Put the ring on Blitz.`, do() { fx({ chem: 4, conf: 2 }); return [`Blitz sleeps nineteen hours a day. Dr. Shaw studies the data for a long time. Then she puts on her reading glasses and studies it again.`, { s: 'Dr. Imani Shaw', t: `This is the healthiest athlete in the building.` }]; } },
      { if: () => !S.items.blitz, label: `Put the ring on Tiny for a week.`, do() { fx({ chem: 4, conf: 1 }); return [`The ring logs Tiny at fourteen hours a night. Dr. Shaw calls you both in.`, { s: 'Dr. Imani Shaw', t: `Mr. Fonoti, according to this, you slept through an entire team meeting.` }, { s: 'Tiny', t: `Yeah. That was a good one.` }]; } },
    ] },

  // ---------------- Rookie life ----------------
  haircut: { tag: 'rookie', label: 'Rookie tradition', if: () => EV.y1() && S.slate <= 5, title: 'The Rookie Cut',
    body: [
      `You walk into the locker room after lifting and find a folding chair in the middle of the floor. A cape. A pair of electric clippers. Eleven veterans, grinning.`,
      `Every rookie gets a haircut. The rookie doesn't get a vote.`],
    choices: [
      { label: `Sit down and let them cook.`, do() { S.flags.ev_haircut = 'fin'; fx({ chem: 8, fame: 3, conf: -2 }); return [`Twenty minutes later, you have a mohawk shaped like a shark fin. It's dyed orange. It's somehow aerodynamic.`, `The team posts a photo. It's their most-liked post of the year, beating a video of the actual owner.`]; } },
      { label: `Negotiate: Tiny holds the clippers.`, do() { fx({ chem: 4, conf: 2 }); return [`Tiny cut hair in high school to pay for cleats. He gives you a fade so clean that two veterans ask for appointments. The tradition is ruined. Everybody's thrilled.`]; } },
      { label: `Grab the clippers and shave it all yourself first.`, do() {
          S.flags.ev_haircut = 'bald'; fx({ chem: 5, vane: 5, conf: 3 });
          return [`You run the clippers straight down the middle before anyone can move. Then the rest of it. The room goes silent.`,
            S.flags.vaneHurt ? `Then Vane, sitting on the training table in his walking boot, starts laughing. It's the first time anybody has heard him laugh since camp.` : `Then Vane starts laughing. It's the first time anybody has heard him laugh since camp.`,
            { s: 'Marcus Vane', t: `Okay. The kid's got guts.` }];
        } },
    ] },

  // ---------------- Heartfelt ----------------
  letter: { tag: 'fan', label: 'Fan mail', if: () => S.slate >= 2, title: 'Dear {first}',
    body: [`A letter shows up in your locker, forwarded by the team's mail room. The envelope is covered in stickers. The handwriting slants uphill.`],
    html: () => `<div class="ev-letter" role="note" aria-label="The letter">
      <p>${fmt('Dear {first} {last},')}</p>
      <p>My name is Ana and I'm 14. I play nose tackle. I'm the only girl in my league. I got cut last year, so I trained all summer in my uncle's garage, and this year I made it.</p>
      <p>My coach says you didn't get drafted. I looked it up. 257 people. That's a lot of people.</p>
      <p>Did you ever want to quit? I almost did. Write back if you can. If you can't, that's okay. You're probably busy.</p>
      <p class="ev-sign">Ana, #71</p>
      <p class="ev-ps">P.S. Please tell Tiny I said hi.</p></div>`,
    choices: [
      { label: `Write back. By hand. All of it.`, do() { S.flags.ev_letter = 'wrote'; fx({ conf: 5, family: 3, energy: -2 }); return [`You write three pages at the kitchen table. The phone that didn't ring. The locker with a strip of tape for a nameplate. The morning you almost didn't get on the plane.`, `At the bottom you write: *Yes. Every week. Don't.*`, `Tiny adds a P.S. of his own. It's mostly drawings of a grill.`]; } },
      { label: `Send a signed jersey and a team photo.`, do() { S.flags.ev_letter = 'jersey'; fx({ fame: 2, conf: 2 }); return [`The whole team signs the photo. Tiny signs it twice, once as Tiny and once as Tavita, "for the record."`, `Ana's coach posts a picture of her holding it. She's trying very hard not to smile, and failing.`]; } },
      { label: `Tape the letter inside your locker.`, do() { fx({ conf: 6 }); return [`You read it before every practice. *Did you ever want to quit?* Every time, the answer gets a little easier.`]; } },
    ] },

  baby: { tag: 'heart', label: '3 a.m. phone call', title: 'Three in the Morning',
    body: [
      `2:51 a.m. Your phone buzzes on the nightstand. It's Gus Pruitt, the long snapper. Gus's whole job is to snap the ball backward fifteen yards. He has never been on TV. He has never missed a snap.`,
      `Gus is breathing like he just ran a forty. His wife is in labor. Their car won't start. Gus is, in his own words, "not doing great."`],
    choices: [
      { label: `Grab your keys. You're driving.`, do() { S.flags.ev_baby = 'drove'; fx({ chem: 9, energy: -12 }); return [`You run two yellow lights that were mostly red. Gus holds his wife's hand in the back seat and counts her breaths out loud. He counts wrong. She corrects him every time.`, `At 6:14 a.m., a nurse hands Gus a seven-pound baby girl. He holds her like a ball on fourth and one.`, `You get to practice twelve minutes late. Coach Bramble hears why and doesn't fine you. He doesn't fine anybody, all week.`]; } },
      { label: `Call them a ride and send flowers.`, do() { fx({ chem: 3, money: -600 }); return [`The car arrives in four minutes. The flowers arrive at 9 a.m. The baby arrives somewhere in between. Gus texts you a photo with fourteen exclamation points.`]; } },
      { label: `Let it go to voicemail. You need the sleep.`, do() { fx({ energy: 5, chem: -5, conf: -2 }); return [`You fall back asleep. In the morning there are four voicemails, and a fifth that says, "Never mind, Tiny came."`, `Tiny shows you forty-one baby photos at lunch and narrates every single one. You feel worse with each photo.`]; } },
    ] },

  jumper: { tag: 'heart', label: 'Parking lot', title: 'Jumper Cables',
    body: [
      `10:40 p.m. The players' lot is empty except for one car with its hood up: a tan 1994 sedan with a cassette deck.`,
      `Standing next to it, staring into the engine like it owes him money, is Coach Bramble.`],
    choices: [
      { label: `Pull up and offer him a jump.`, do() { S.flags.ev_jumper = 'jump'; fx({ coach: 8 }); return [`He doesn't say yes. He just hands you the cables.`, `While the battery charges, Bramble talks for six whole minutes. His first coaching job, in a town of nine hundred people. The bus that broke down before the state final. How his players pushed it two miles to the stadium, and then won.`, `The engine turns over. He closes the hood.`, { s: 'Coach Bramble', t: `This conversation didn't happen.` }]; } },
      { label: `Offer him a ride home instead.`, do() { S.flags.ev_jumper = 'ride'; fx({ coach: 5, conf: 2 }); return [`Twenty-two minutes. He doesn't say a word. He holds the handle above the door the entire time, even on the straightaways.`, `In his driveway, he gets out, then leans back in.`, { s: 'Coach Bramble', t: `Thank you, {last}.` }, `You sit in his driveway for a full minute after he goes inside.`]; } },
      { label: `Pretend you didn't see him.`, do() { fx({ coach: -3, energy: 3 }); return [`You drive past with your eyes straight ahead. In the mirror, you see him watching you go.`, `At practice the next day, Bramble makes you run your sprints twice. He doesn't explain why. He doesn't have to.`]; } },
    ] },

  flag: { tag: 'heart', label: 'Charity day', if: () => S.slate >= 1, title: 'Recess Rules',
    body: [
      `The team's charity day: flag football against the fourth grade at Harbor City Elementary. Thirty-one kids. One of you. The kids have been practicing for three weeks.`,
      `Their quarterback is a girl named Priya with a whistle around her neck and a laminated playbook. She looks you dead in the eye.`,
      `"You're going down, pro."`],
    choices: [
      { label: `Play for real. Juke the whole fourth grade.`, sub: 'Playable moment', then: evPlay('flag') },
      { label: `Let them win. Dramatically.`, do() { fx({ fame: 5, conf: 2, family: 2 }); return [`You fall in slow motion. You clutch your heart. You crawl toward the goal line and collapse one inch short. A kid named Mateo spikes the ball on your chest.`, `Every parent in the bleachers films it. {fam} watches the clip nine times and then calls to ask if your knee is okay.`]; } },
      { label: `Be the all-time quarterback for both teams.`, do() { fx({ chem: 3, fame: 3, conf: 3 }); return [`Every kid gets a pass thrown to them. Every kid scores. The final score is 98 to 97, and nobody knows who won.`, `Priya demands a rematch. You promise her one.`]; } },
    ],
    play: { title: 'Fourth-Grade Blitz', type: 'combo', diff: 2, label: 'Jukes', prompt: 'Hit the moves in order and juke the fourth grade before they swarm you.',
      setup: [`Priya calls a blitz. All thirty-one kids come at once, screaming. It sounds like a fire alarm wearing sneakers.`, `You have the ball and sixty yards of grass.`],
      titles: { great: 'Recess Legend', good: 'So Close', bad: 'Stuffed' },
      done(r) {
        S.flags.ev_kids = r;
        if (r === 'great') { award('ev_recess'); fx({ fame: 5, conf: 4 }); return [`Left, right, spin, hurdle a kid who is lying down on purpose. You juke the entire fourth grade.`, `At the goal line you stop and hand the ball to the smallest kid on the field, a first grader who wasn't even supposed to be playing. He scores. The fourth grade carries him off the field on their shoulders.`]; }
        if (r === 'good') { fx({ fame: 3, conf: 2 }); return [`You make it to the five-yard line before Priya pulls your flag from behind. She doesn't celebrate. She just says, "Film room, pro," and walks away.`]; }
        fx({ fame: 6, conf: -4 }); return [`A nine-year-old pulls your flag in the backfield for a twelve-yard loss.`, `The clip is called FOURTH GRADER STUFFS PRO, and it plays on three national shows. Tiny watches it every morning before practice, for motivation.`];
      } } },

  // ---------------- Tempting ----------------
  coin: { tag: 'tempt', label: 'Investment tip', if: () => S.st.money >= 15000 && S.slate <= 7, title: 'HammerCoin',
    get body() {
      const pitch = S.flags.agent === 'sly'
        ? [{ s: 'Sly Pemberton', t: `Kid. HammerCoin. It's a cryptocurrency with a shark on it. I'm in. My dentist is in. Three of the Monarchs are in. It's going to the moon, and then the moon is going up too.` }]
        : [`In the weight room, a guy named Chad with a shark-tooth necklace corners you between sets. "HammerCoin," he says. "It's a cryptocurrency with a shark on it. Three of the Monarchs are in. It's going to the moon." He says *moon* like it's somebody he knows personally.`];
      return [`Suddenly everybody in the locker room is an expert on something called HammerCoin.`].concat(pitch, [`The logo is a cartoon shark in sunglasses. The price chart only goes up. That is usually a bad sign. It is a very nice chart.`]);
    },
    choices: [
      { if: () => S.st.money >= 50000, label: `Put in $50,000. Fortune favors the bold.`, do() { S.flags.ev_coin = 50000; fx({ money: -50000, conf: 2 }); return [`You buy fifty thousand HammerCoins at a dollar each. When the purchase goes through, the shark in the logo winks at you. You're not sure that's a good sign either.`, { note: `You'll find out how HammerCoin does in a week or two.` }]; } },
      { label: `Put in $10,000. Just to see.`, do() { S.flags.ev_coin = 10000; fx({ money: -10000 }); return [`Ten thousand HammerCoins. You check the price forty times before practice. It goes up two cents. You feel like a genius.`, { note: `You'll find out how HammerCoin does in a week or two.` }]; } },
      { if: () => S.flags.agent === 'steady', label: `Forward it to Margaret.`, do() { fx({ conf: 2, coach: 1 }); return [`Margaret replies in four minutes.`, { s: 'Margaret', t: `I read the whitepaper. It is four pages long. Three of the pages are a picture of the shark. No.` }, `You don't buy any. You do save the shark picture.`]; } },
      { label: `Walk away.`, do() { fx({ conf: 1 }); return [S.flags.agent === 'sly' ? `You tell Sly no. He looks at you with real pity, puts his sunglasses back on, and goes to pitch the kicker.` : `You tell Chad no. He looks at you with real pity and goes to pitch the kicker.`]; } },
    ] },

  yacht: { tag: 'tempt', label: 'Night out', if: () => S.slate >= 2, title: 'The Yacht',
    body: [
      `Thursday night. A text from a number you don't know: a photo of a yacht the size of an apartment building, lit up purple, with a DJ booth on the top deck.`,
      `*Party tonight. Big names. Boat leaves the marina at 10. Bring nobody.*`,
      `Tiny's cousin says it's legit. Tiny's cousin also once sold Tiny a timeshare on a lake that doesn't exist.`],
    choices: [
      { label: `Get on the boat.`, do() {
          S.flags.ev_yacht = 'stuck';
          const open = `The party is incredible. The boat leaves the marina at ten. It doesn't come back until four in the morning, because the captain is also at the party.`;
          if (chance(0.5)) { fx({ fame: 6, energy: -24, coach: -6 }); return [open, `By 7 a.m., a photo of you wearing a captain's hat that isn't yours is on every sports site in the country. Bramble prints it, tapes it to the whiteboard, and writes one word underneath: WHY.`]; }
          fx({ fame: 4, energy: -22, chem: 2 }); return [open, `You sleep for two hours. Somehow, no photos leak. You spend all of Friday's practice feeling the ocean in your knees.`];
        } },
      { label: `Go, but stay on the dock.`, do() { fx({ conf: 2, energy: -3 }); return [`The yacht pulls away at ten with a hundred people on board. You wave from the dock, holding a hot dog from a cart.`, `The yacht gets back at 4 a.m. You are asleep by 10:30. It was the best hot dog of your life.`]; } },
      { label: `Send Tiny for the free food.`, do() { fx({ chem: 5, energy: -2 }); return [`Tiny boards with an empty backpack. Forty minutes later he paddles back to the dock in a borrowed kayak with sixty shrimp wrapped in napkins.`, `You don't ask. You eat the shrimp.`]; } },
      { label: `Delete the text. Go to bed.`, do() { fx({ energy: 8, coach: 1 }); return [`You're asleep by ten. You dream about boats anyway.`]; } },
    ] },

  mansion: { tag: 'tempt', label: 'Real estate', if: () => S.st.money >= 90000, title: 'The House With the Moat',
    body: [
      `Your apartment still has no furniture. A realtor in very large sunglasses offers to fix that by renting you a mansion for the rest of the season.`,
      `It has a bowling alley, a koi pond, a movie theater, and, for reasons she can't explain, a moat.`,
      `$65,000 for the season. "The moat is included," she says, like that's a selling point. It is, a little.`],
    choices: [
      { label: `Sign the lease. You live in a castle now.`, sub: 'Costs $65,000', do() { S.flags.ev_moat = true; fx({ money: -65000, fame: 5, conf: 4, chem: 5 }); return [`Team dinner moves to your place permanently. Tiny bowls a 61 in your bowling alley and celebrates like he won the lottery.`, `On the first night, the punter falls in the moat. On the second night, so does Tiny. You start keeping towels by the drawbridge.`]; } },
      { label: `Buy one really good couch instead.`, do() { fx({ money: -2400, conf: 3, energy: 6 }); return [`It's a big, soft, gray couch. You sleep on it every night for a week because it's nicer than your bed.`, `Your apartment now has exactly one piece of furniture, and it's perfect.`]; } },
      { label: `Bring Tiny to inspect the moat.`, do() { fx({ chem: 6, conf: 1, money: -500 }); return [`Tiny declares the moat "structurally fun," then cannonballs in to test the depth. It's three feet deep. The koi are furious.`, `You don't rent the house. The realtor bills you $500 for the koi's emotional distress anyway.`]; } },
    ] },

  // ---------------- Football ----------------
  trick: { tag: 'football', label: 'Lunch break', if: () => EV.y1() && EV.rostered() && S.slate <= 8, title: 'The Napkin Play',
    get body() {
      const t = EV.byPos(EV_TRICK);
      return [
        `Lunch. You're not even thinking about it. You start drawing on a napkin with a hotel pen: arrows, circles, one squiggly line.`,
        `By the time your sandwich is gone, it's a whole play. ${t.desc}`,
        `Across the table, Coach Okafor reads it upside down. She puts down her fork.`,
        { s: 'Coach Okafor', t: `Who drew this?` }];
    },
    choices: [
      { label: `Raise your hand. "Me. Let me run it."`, sub: 'Playable moment', then: evPlay('trick') },
      { label: `Give the napkin to Tiny.`, do() { fx({ chem: 6 }); return [`Tiny studies it like a treasure map. Then he adds a circle with a T in it, running straight down the middle of the field, wide open.`, { s: 'Tiny', t: `That's me. I'm the surprise.` }, `He laminates the napkin. It lives in his wallet now.`]; } },
      { label: `Crumple it up. It's just a doodle.`, do() { fx({ coach: 1, conf: -1 }); return [`You toss it in the trash. When you look back, Okafor is fishing it out, smoothing it flat on the table, and folding it into her playbook.`]; } },
    ],
    play: { title: 'One Rep', type: 'reaction', diff: 1.6, fakes: 2, label: 'Snap count', prompt: 'Go on the real snap. The starting defense will try to draw you offside.',
      get setup() { return [`Thursday. Okafor takes the napkin to Coach Bramble. He looks at it for a long time, then lets you run ${EV.byPos(EV_TRICK).name} once against the starting defense.`, { s: 'Coach Bramble', t: `One rep, {last}. If it works, it's in Sunday's game plan. Don't jump.` }]; },
      titles: { great: 'It\'s In', good: 'Clean It Up', bad: 'Back to Being a Napkin' },
      done(r) {
        const t = EV.byPos(EV_TRICK);
        if (r !== 'bad') {
          S.flags.ev_trick = 'in'; S.flags.ev_trickWk = S.slate + 1;
          fx(r === 'great' ? { coach: 6, conf: 5 } : { coach: 3, conf: 3 });
          return [t.run, r === 'great' ? `Two defensive starters run into each other trying to catch up. The scout team cheers like it's the Championship.` : `The timing's a hair late, but it still goes for twenty-four yards against the best defense in the building.`,
            { s: 'Coach Bramble', t: r === 'great' ? `It's in. If we get the look Sunday, it's yours.` : `Clean it up. It's in.` },
            { note: `${t.name} is in the playbook. Make a big play in a game and it gets called.` }];
        }
        S.flags.ev_trick = 'dead'; fx({ conf: -3, coach: 1 });
        return [`The defense smells it before the ball is snapped. A linebacker is standing in the exact spot where your play was supposed to happen, waving at you.`, `Bramble folds the napkin very neatly and puts it in his pocket. You never see it again. You think about it all week.`];
      } } },

  film: { tag: 'football', label: 'Film room', if: () => EV.y1() && S.slate >= 1, title: 'Two Coaches, One Clip',
    body: [
      `Film room, 7 a.m. Coach Bramble and Coach Okafor have been watching the same four seconds of tape for twenty minutes, and they do not agree.`,
      `The clicker has been passed back and forth so many times it's warm.`,
      { s: 'Coach Okafor', t: `{last}. You're the tiebreaker. Tell him what you see.` }],
    choices: [
      { label: `Take the clicker and make the call.`, sub: 'Playable moment', then: evPlay('film') },
      { label: `"Honestly? I think you're both right."`, do() { fx({ coach: -1, chem: 2 }); return [`Both coaches turn and look at you at exactly the same time. It's the scariest thing that has ever happened to you in this building.`, `They send you to get coffee. You take the long way.`]; } },
    ],
    play: { title: 'The Tiebreaker', type: 'read', diff: 1.4, label: 'Tiebreaker', prompt: 'Both coaches are waiting. Make the call before the clock runs out.',
      get setup() { return [EV.byPos(EV_FILM).clip, `Both coaches look at you. The room is very quiet.`]; },
      get read() { return EV.byPos(EV_FILM).read; },
      startBtn: 'Roll the tape', help: t => t.replace(/once you break the huddle/, 'once the tape rolls'), flash: { 'Delay of game': 'Out of time' },
      titles: { great: 'Called It', good: 'Close Enough', bad: 'More Film' },
      done(r, x) {
        const late = x && /play clock/i.test(x.text || '');
        const said = late ? [`You stare at the frozen frame so long that Bramble takes the clicker back. "Somebody decide something," he says. Nobody does.`] : x && x.text ? [x.text] : [];
        if (r === 'great') { fx({ skill: 3, coach: 6, conf: 3 }); return said.concat([`Okafor holds out her hand. After a long pause, Bramble takes out his wallet and gives her five dollars. They had a bet. You had no idea.`]); }
        if (r === 'good') { fx({ skill: 2, coach: 2 }); return said; }
        fx({ coach: -2, conf: -2 }); return said.concat([`For the first time all morning, both coaches agree on something: you need more film.`]);
      } } },

  // ---------------- Callbacks (pay off earlier events) ----------------
  coin2: { tag: 'callback', from: 'coin', followup: true, if: () => S.flags.ev_coin > 0 && !S.flags.ev_coinDone && EV.seenBefore('coin'),
    get title() { return EV.coinOut() === 'moon' ? 'To the Moon' : 'The Shark Sank'; },
    html: () => evTicker(),
    get body() {
      const amt = S.flags.ev_coin || 10000, who = S.flags.agent === 'sly' ? 'Sly' : 'Chad';
      return EV.coinOut() === 'moon'
        ? [`Your phone has sixty-one notifications, and all of them are about HammerCoin.`, `It's up 340 percent. Your ${money(amt)} is now worth **${money(amt * 4.4)}**. Tiny is standing behind you, reading over your shoulder, breathing very loudly.`, `Nobody knows why it went up. That's also why nobody knows when it'll come down.`]
        : [`Your phone has sixty-one notifications, and all of them are about HammerCoin.`, `It's down 97 percent. The HammerCoin website now just says *lol*. ${who}'s phone goes straight to voicemail.`, `Your ${money(amt)} is now worth **${money(amt * 0.03)}**.`];
    },
    get choices() {
      const amt = S.flags.ev_coin || 10000;
      const done = v => { S.flags.ev_coin = v; S.flags.ev_coinDone = true; };
      if (EV.coinOut() === 'moon') return [
        { label: `Sell everything. Right now.`, do() { done('cashed'); fx({ money: Math.round(amt * 4.4), conf: 4 }); award('ev_coin'); return [`You sell at 10:14 a.m. At 10:31, HammerCoin's founder posts a video from a yacht that just says "lol," and the price falls off a cliff.`, `You were seventeen minutes from zero. You go lie down on the floor for a while.`]; } },
        { label: `Hold. To the moon.`, do() {
            if (chance(0.25)) { done('cashed'); fx({ money: Math.round(amt * 9), fame: 3 }); award('ev_coin'); return [`It goes up again. And again. You sell at nine times what you paid, mostly because your hands are shaking too hard to keep watching.`, `Tiny asks for a loan for a third grill. You give him one.`]; }
            done('held'); fx({ money: Math.round(amt * 0.02), conf: -4 }); return [`By lunch, HammerCoin is worth less than the napkin you'd write its name on. You sell what's left for ${money(amt * 0.02)}.`, `Tiny tries to cheer you up by explaining that money is "just paper, emotionally." It doesn't help. He explains it again, slower.`];
          } },
        { label: `Sell half, keep half.`, do() { done('half'); fx({ money: Math.round(amt * 2.2 + amt * 0.01), conf: 2 }); award('ev_coin'); return [`The half you sold more than doubles your money. The half you kept is worth eleven dollars by Friday.`, `Tiny calls it "a coin flip with extra steps." He's not wrong.`]; } },
      ];
      return [
        { label: `Sell what's left.`, do() { done('sold'); fx({ money: Math.round(amt * 0.03), conf: -2 }); return [`You get back ${money(amt * 0.03)}. It covers one nice dinner. You eat it alone, thinking about sharks.`]; } },
        { label: `Hold. It'll come back.`, do() { done('held'); fx({ conf: -1 }); return [`It does not come back. But you keep it, because selling would make it real.`]; } },
        { if: () => S.st.money >= 5000, label: `Buy the dip.`, do() { done('dip'); fx({ money: -5000, conf: -2 }); return [`You put in another $5,000. It dips further. There was more dip. There is always more dip.`]; } },
      ];
    } },

  chef2: { tag: 'callback', from: 'chef', followup: true, if: () => S.flags.ev_chef === 'fire' && EV.seenBefore('chef'), title: 'Mr. December',
    body: [
      `The Harbor City Fire Department makes a charity calendar every year. Twelve firefighters, twelve months, one good cause.`,
      `This year they want a thirteenth month. They want the player whose kitchen they put out on a livestream.`,
      `The fire captain is very serious about it. You'd be holding a fire extinguisher. You'd be wearing an apron that says KISS THE COOK (ALLEGEDLY).`],
    choices: [
      { label: `Pose. With the extinguisher.`, do() { S.flags.ev_chef = 'calendar'; fx({ fame: 8, conf: 3 }); return [`The photographer says "smolder." You do your best. The calendar sells out in two days and raises $90,000 for the burn unit at Harbor City General.`, `You are, officially and forever, Mr. December.`]; } },
      { label: `Only if Tiny gets a month too.`, do() { S.flags.ev_chef = 'calendar'; fx({ fame: 5, chem: 6 }); return [`Tiny is Mr. July: grilling, in an apron, in front of a fire truck. His month outsells yours three to one.`, `He signs every copy "Stay hot." The firefighters make him an honorary captain.`]; } },
      { if: () => S.st.money >= 10000, label: `Decline, and write them a check instead.`, sub: 'Costs $10,000', do() { fx({ money: -10000, coach: 2, conf: 2 }); return [`You send $10,000 and a handwritten apology. The firefighters frame the apology and hang it in the firehouse kitchen, directly above the stove.`]; } },
    ] },

  superfan2: { tag: 'callback', from: 'rabbit', followup: true, if: () => EV.seenBefore('rabbit'), title: 'The Mural',
    body: [
      `Remember the woman in the foam shark hat from the autograph line? She has painted your face on her garage door. It's twenty feet tall.`,
      `It's mostly accurate. The eyebrows are very ambitious.`,
      { s: 'Superfan', t: `It took me eleven days. My neighbors hate it. Come see it in person?` }],
    choices: [
      { label: `Drive over and sign it.`, do() {
          fx({ fame: 5, conf: 4, energy: -4 });
          return [`You sign your name across the bottom of the garage door in orange paint. She makes you lemonade. It's very sour. You drink all of it.`,
            S.items.luck ? `You show her the rabbit's foot, still tucked in your sock. She cries. Then her neighbors come out, and they cry too, and then they ask for autographs.` : `Half the street comes out to watch. Her neighbors, it turns out, love the mural. They've been pretending to hate it as a joke.`];
        } },
      { label: `Invite her to practice.`, do() { fx({ chem: 4, fame: 2, coach: 1 }); return [`She shows up in the shark hat. Coach Bramble lets her blow his whistle once. She takes it very seriously.`, `It is the loudest whistle anyone in the building has ever heard. Two linemen drop to the ground out of instinct.`]; } },
      { label: `Send Tiny to touch up the eyebrows.`, do() { fx({ chem: 5, fame: 3 }); return [`Tiny brings a ladder and a very small brush and works for three hours. When he's done, the eyebrows are worse, and he has also painted himself into the background, waving.`]; } },
    ] },

  blitz2: { tag: 'callback', from: 'dog', followup: true, if: () => EV.y1() && !!S.items.blitz && EV.seenBefore('dog'), title: 'The Dog Ate My Playbook',
    body: [
      `You come home from practice and find your playbook on the living room floor. It used to be three hundred pages. About forty are left.`,
      `Blitz is lying next to it with a page stuck to his nose. It's the red-zone section. He looks extremely proud of himself.`,
      `You have a film session with Okafor at 7 a.m.`],
    choices: [
      { label: `Tell Okafor the truth.`, do() { fx({ coach: 3, conf: 2 }); return [{ s: 'Coach Okafor', t: `The dog ate it.` }, `You hold up a plastic bag full of evidence. She looks at the pages. She looks at you. Then, for the first time in your presence, she laughs so hard she has to sit down.`, `She prints you a new playbook. She also prints one for Blitz and puts it in a sandwich bag, "so he leaves yours alone."`]; } },
      { label: `Stay up all night rebuilding it from memory.`, do() { fx({ skill: 4, energy: -12, coach: 2 }); return [`You rewrite two hundred and sixty pages by hand. At 4 a.m., Blitz falls asleep on the red-zone section again.`, `Okafor flips through your handwritten copy without saying anything. Then she quietly keeps it and hands you a printed one.`]; } },
      { label: `Tell Okafor that Tiny's dog ate it.`, do() { fx({ chem: -2, coach: -2, conf: 1 }); return [`Tiny doesn't have a dog. Tiny is standing right there. He looks at you with deep and personal betrayal, then turns to Okafor.`, { s: 'Tiny', t: `Yeah. My dog. Real bad dog.` }, `Okafor doesn't believe either of you. You both run.`]; } },
    ] },
});

// Two more weeks can have a random event (Week 8 and the Conference Championship week), unless they're already crowded.
const EV_EXTRA_SLATES = [7, 11];
EV_EXTRA_SLATES.forEach(n => { if (!RANDOM_SLATES.includes(n)) RANDOM_SLATES.push(n); });
const EV_FOLLOWUPS = ['coin2', 'chef2', 'superfan2', 'blitz2'];

TROPHIES.push(
  ['ev_napkin', 'Drawn on a Napkin', 'Invent a trick play at lunch, then hit it on Sunday.'],
  ['ev_recess', 'Recess Legend', 'Juke the entire fourth grade at the charity flag football game.'],
  ['ev_coin', 'Sold the Top', 'Get out of HammerCoin with more money than you put in.'],
);
ITEMS.tape = ['Rocco\'s tape job', 'Ankles taped like a work of art. +3 Energy at the start of every week.'];
ITEMS.sleep = ['Dr. Shaw\'s sleep plan', 'Lights out at ten. +4 Energy at the start of every week.'];

// ---------- The playable moment inside an event ----------
P.ev_mini = a => {
  const E = EVENTS[a.e], m = E && E.play;
  if (!m) return { kicker: weekKicker(), title: 'Back to Work', body: [`The moment passes. There's a game on Sunday.`], next: 'queue' };
  const diff = clamp(mod('diff', m.diff || 1.6, { event: a.e }), 0.6, 5.5);
  return {
    kicker: weekKicker(),
    title: m.title,
    body: m.setup,
    mini: {
      type: m.type, diff, label: m.label, prompt: m.prompt, btn: m.btn, fakes: m.fakes,
      read: m.read, edge: m.type === 'read' ? hasEdge() : false,
      onDone(r, x) {
        const out = m.done(r, x) || [];
        go('_result', { body: out, next: 'queue', kicker: weekKicker(), title: (m.titles && m.titles[r]) || m.title });
      },
    },
  };
};

// ---------- HammerCoin ticker card ----------
function evTicker() {
  const moon = EV.coinOut() === 'moon';
  const pts = moon ? [12, 14, 13, 17, 16, 21, 24, 23, 31, 38, 47, 58, 72, 88] : [12, 15, 14, 20, 26, 33, 41, 39, 52, 66, 4, 2.5, 3, 2];
  const W = 280, H = 76, max = 92;
  const line = pts.map((v, i) => `${(i / (pts.length - 1) * W).toFixed(1)},${(H - 4 - v / max * (H - 10)).toFixed(1)}`).join(' ');
  const price = moon ? '$4.40' : '$0.03', ch = moon ? '+340%' : '−97%';
  return `<div class="ev-ticker ${moon ? 'up' : 'down'}" role="img" aria-label="HammerCoin price chart: ${moon ? 'up 340 percent' : 'down 97 percent'}">
    <div class="evt-top"><span class="evt-sym">HMRC</span><span class="evt-name">HammerCoin</span><span class="evt-price">${price}</span><span class="evt-ch">${ch}</span></div>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${line}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>
  </div>`;
}

// ---------- Event chips (category tag on every event page) ----------
const EV_ICONS = {
  fun: '<path d="M8 1.6v3M8 11.4v3M1.6 8h3M11.4 8h3M3.5 3.5l2.1 2.1M10.4 10.4l2.1 2.1M3.5 12.5l2.1-2.1M10.4 5.6l2.1-2.1"/>',
  heart: '<path d="M8 13.4S2.2 9.9 2.2 5.9A2.9 2.9 0 0 1 8 4.6a2.9 2.9 0 0 1 5.8 1.3c0 4-5.8 7.5-5.8 7.5z"/>',
  tempt: '<circle cx="8" cy="8" r="6.1"/><path d="M10 5.9C9.6 5.3 8.9 5 8 5c-1.1 0-2 .6-2 1.5S7 7.8 8 8s2 .6 2 1.5S9.1 11 8 11c-.9 0-1.7-.3-2.1-.9M8 3.6V5M8 11v1.4"/>',
  football: '<path d="M2.6 13.4C1.9 9 4.6 3.9 13.4 2.6c.7 4.4-2 9.5-10.8 10.8z"/><path d="M6 10l4-4M7 7.4l1.6 1.6M8.3 6.1l1.6 1.6"/>',
  rookie: '<path d="M8 1.9l1.85 3.8 4.2.6-3.05 2.95.72 4.15L8 11.45 4.28 13.4 5 9.25 1.95 6.3l4.2-.6z"/>',
  fan: '<rect x="2" y="3.6" width="12" height="8.8" rx="1.4"/><path d="M2.6 4.6L8 8.8l5.4-4.2"/>',
  callback: '<path d="M3.1 8.6A5 5 0 1 0 4.6 4.4"/><path d="M4.4 1.9v2.7h2.7"/>',
};
// Chips for the events that shipped with the base game.
const EV_BASE_TAGS = {
  viral: ['fun', 'Going viral'], fender: ['fun', 'Parking lot'], dinner: ['rookie', 'Rookie tradition'], club: ['tempt', 'Night out'],
  pep: ['heart', 'Back home'], rabbit: ['fan', 'Autograph line'], zapp: ['tempt', 'Endorsement'], fiveam: ['football', 'Practice'],
  troll: ['fun', 'Online'], hammy: ['football', 'Training room'], song: ['rookie', 'Rookie tradition'], cards: ['tempt', 'Team plane'],
  reporter: ['football', 'Media'], dog: ['heart', 'Practice field'], helmets: ['heart', 'Back home'], car: ['tempt', 'Showroom'],
  snow: ['football', 'Practice'], legend: ['football', 'Legends'],
};
function evChip(k) {
  const E = EVENTS[k];
  if (!E) return '';
  let tag = E.tag, label = E.label;
  if (!tag) { const b = EV_BASE_TAGS[k]; tag = b ? b[0] : 'fun'; label = b ? b[1] : 'Off the field'; }
  if (tag === 'callback') {
    const s = E.from && EV.st().seen[E.from];
    label = 'Callback' + (s ? (s.y < EV.year() ? ' · Last season' : ` · Week ${s.n + 1}`) : '');
  }
  return `<div class="ev-meta"><span class="ev-tag${tag === 'callback' ? ' cb' : ''}"><svg viewBox="0 0 16 16" aria-hidden="true">${EV_ICONS[tag] || EV_ICONS.fun}</svg><span>${esc(label || 'Off the field')}</span></span></div>`;
}

on('page', (pg, el, id) => {
  if (!S || !S.at) return;
  if (id === 'event' || id === 'ev_mini') {
    const k = S.at.args && S.at.args.e, E = k && EVENTS[k];
    if (!E) return;
    if (id === 'event') {
      const st = EV.st();
      if (!st.seen[k]) { st.seen[k] = { y: EV.year(), n: S.slate }; save(); }
      if (E.html) {
        const story = el.querySelector('.story');
        const h = typeof E.html === 'function' ? E.html() : E.html;
        if (story && h) story.insertAdjacentHTML('afterend', h);
      }
    }
    const kick = el.querySelector('.kicker');
    if (kick) kick.insertAdjacentHTML('afterend', evChip(k));
    if (id === 'ev_mini' && E.play) evRelabel(E.play, el.querySelector('#mini'));
    return;
  }
  // The napkin play gets called in a real game.
  if (id === 'g_mres' && S.game && S.flags.ev_trickAt) {
    const t = S.flags.ev_trickAt;
    if (t.y === EV.year() && t.n === S.game.n && t.mi === S.game.mi - 1) {
      const story = el.querySelector('.story');
      const name = EV.byPos(EV_TRICK).name;
      if (story) story.insertAdjacentHTML('afterbegin', `<div class="ev-callout"><span class="ev-callout-k">From the napkin</span><p>${fmt(`Okafor signals it in from the sideline: **${name}**. Your play. The one you drew at lunch in Week ${S.flags.ev_trickWk || '?'}.`)}</p></div>`);
    }
  }
});

// The core mini-games say football things ("Break the huddle", "Snap it"). An event can rename
// the start button, the help line and the result flash so they fit the scene.
function evRelabel(m, host) {
  if (!host) return;
  const b = host.querySelector('.mg-btn'), h = host.querySelector('.mg-help');
  if (m.startBtn && b) b.textContent = m.startBtn;
  if (m.help && h) h.textContent = typeof m.help === 'function' ? m.help(h.textContent) : m.help;
  if (m.flash && window.MutationObserver) {
    const ob = new MutationObserver(() => {
      const sp = host.querySelector('.flash span');
      if (sp && m.flash[sp.textContent]) { sp.textContent = m.flash[sp.textContent]; ob.disconnect(); }
    });
    ob.observe(host, { childList: true, subtree: true });
  }
}

on('play', p => {
  if (!S || !S.game || !p || p.clutch || p.r !== 'great' || S.flags.ev_trick !== 'in') return;
  S.flags.ev_trick = 'hit';
  S.flags.ev_trickAt = { y: EV.year(), n: S.game.n, mi: S.game.mi };
  fx({ fame: 3, coach: 2 });
  award('ev_napkin');
});

on('weekStart', n => {
  if (!S) return;
  // Items from events.
  const bonus = (S.items.tape ? 3 : 0) + (S.items.sleep ? 4 : 0);
  if (bonus) fx({ energy: bonus }, true);
  const q = S.queue || [];
  const i = q.findIndex(x => x && typeof x === 'object' && x.id === 'event');
  if (i < 0) return;
  const drawn = q[i].args && q[i].args.e;
  // drawEvent() already noted the drawn event as "seen" for future careers. If we take it back,
  // forget that too (only when this draw was the first time), so unseen events stay favored.
  const unuse = k => {
    S.used = (S.used || []).filter(u => u !== k);
    try { const d = trophyData(); if (d.events[k] && Date.now() - d.events[k] < 5000) { delete d.events[k]; store.set(TROPHY_KEY, d); } } catch (e) { /* ignore */ }
  };
  // The two extra event weeks only get an event when the week isn't already busy.
  if (EV_EXTRA_SLATES.includes(n)) {
    const story = q.filter(x => { const id = typeof x === 'string' ? x : x && x.id; return id && !['week_intro', 'week_hub', 'game_pre'].includes(id); }).length;
    if (story > 2) { q.splice(i, 1); unuse(drawn); return; }
  }
  // A callback that is ready usually wins the slot, so earlier choices pay off.
  if (EV_FOLLOWUPS.includes(drawn)) return;
  const ready = EV_FOLLOWUPS.filter(k => EVENTS[k] && !(S.used || []).includes(k) && (!EVENTS[k].if || EVENTS[k].if()));
  if (ready.length && chance(0.75)) {
    const k = ready[0];
    unuse(drawn);
    S.used.push(k);
    remember('events', k);
    q[i] = { id: 'event', args: { e: k } };
  }
});

// ---------- Epilogue lines (the two most memorable ones per season) ----------
const EV_CODAS = [
  () => S.flags.ev_trick === 'hit' ? `Okafor frames your napkin play and hangs it in the film room. Under it, a small brass plate: *${EV.byPos(EV_TRICK).name}. Drawn by {first} {last} at lunch.*` : null,
  () => S.flags.ev_baby === 'drove' ? `Gus Pruitt's daughter is named Josephine {first} Pruitt. Gus says the middle name is non-negotiable. She comes to every home game in ear protectors the size of grapefruits.` : null,
  () => S.flags.ev_letter === 'wrote' ? `In the spring, a second letter arrives from Ana. She made the high school team as a freshman. Starting nose tackle. She drew a picture of herself sacking you. It's on your fridge.` : null,
  () => ({ cashed: `You never touch HammerCoin again. Tiny still calls you "Wall Street," and you let him.`, half: `You never touch HammerCoin again. Tiny still calls you "Wall Street," and you let him.`, held: `You still have HammerCoin in a digital wallet somewhere. It's worth $3.12. You check it every morning anyway.`, dip: `You still have HammerCoin in a digital wallet somewhere. It's worth $4.80, because you bought the dip.` })[S.flags.ev_coin] || null,
  () => S.flags.ev_jumper ? `On the last day of the season, there's a brand-new car battery in your locker with a bow on it. No card. You know exactly who it's from.` : null,
  () => S.flags.ev_trick === 'in' ? `Your napkin play sat in the playbook all season and never got called. Okafor swears she's saving it for something big. You believe her.` : null,
  () => S.flags.ev_chompers === 'star' ? `Nobody ever finds out who was inside the Chompers suit at Fan Fest. Rocco, the equipment manager, knows. Rocco will take it to his grave.` : S.flags.ev_chompers === 'fell' ? `Nobody ever finds out who was inside the Chompers suit at Fan Fest. The tuba section has its suspicions.` : null,
  () => S.flags.ev_chef === 'calendar' ? `The Harbor City Fire Department calendar hangs in every firehouse in the state. You're Mr. December, holding a fire extinguisher and a smile you practiced for an hour.` : S.flags.ev_chef === 'fire' ? `The Harbor City Fire Department still shows your cooking stream at safety trainings. Slide 14: What Not to Do.` : null,
  () => S.flags.ev_kids === 'great' ? `Harbor City Elementary votes you its Recess Legend of the year. It's the only award you've ever won unanimously. Priya is still waiting on her rematch.` : null,
  () => S.flags.ev_yacht ? `Somewhere out there is a photo of you on a yacht at 3 a.m., wearing a captain's hat that isn't yours. It resurfaces every year around Thanksgiving.` : null,
  () => S.flags.ev_moat ? `You never figure out how to drain the moat. Tiny keeps a canoe in it.` : null,
  () => S.flags.ev_goose === 'friend' ? `The goose comes back to the practice field every fall. The groundskeepers call it {last}. It still won't let anyone but you near the thirty-yard line.` : S.flags.ev_goose === 'blitz' ? `Blitz and the goose are still best friends. They share a fan account, and the goose does all the posting.` : null,
  () => S.flags.ev_haircut === 'fin' ? `The shark-fin haircut grows out by March. The photo becomes the team's official holiday card. Forever.` : null,
];
function evCoda(i) {
  const out = [];
  for (const f of EV_CODAS) { try { const t = f(); if (t) out.push(t); } catch (e) { console.error(e); } }
  return out[i] || null;
}
// CODAS lives in 50-engine.js, so it is registered from 52-events-codas.js.
