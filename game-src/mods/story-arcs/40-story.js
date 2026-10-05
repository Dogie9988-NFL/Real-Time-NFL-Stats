
// ---------- Trophies (saved across careers) ----------
const TROPHIES = [
  ['camp', 'Welcome to the League', 'Survive training camp.'],
  ['bigplay', 'Highlight Reel', 'Make a big play in a real game.'],
  ['six', 'Six Points', 'Score a touchdown. A pick-six counts.'],
  ['clutch', 'Ice in the Veins', 'Win a game with a clutch play in the final minutes.'],
  ['perfect', 'Perfect Game', 'Earn an A+ game grade.'],
  ['playoffs', 'Playoff Bound', 'Make the playoffs.'],
  ['champ', 'Champion', 'Win the Championship.'],
  ['mvp', 'Legend', 'Reach the Legend ending.'],
  ['undefeated', 'Perfect Season', 'Go 10-0 in the regular season.'],
  ['fame', 'Household Name', 'Reach 80 Fame.'],
  ['chem', 'Brotherhood', 'Reach 85 Chemistry.'],
  ['torch', 'Torch Passed', 'Earn Marcus Vane\'s respect (Vane 60 or higher).'],
  ['family', 'Hometown Hero', 'Reach 95 Family.'],
  ['blitz', 'Good Boy', 'Adopt the practice-field dog.'],
  ['leo', 'A Promise Kept', 'Keep your promise to Leo.'],
  ['empty', 'Running on Fumes', 'Play a game with Energy under 15.'],
  ['rich', 'Set for Life', 'Finish a season with $750,000 or more in the bank.'],
  ['squad', 'From the Bottom', 'Win a playoff game after starting on the practice squad.'],
  ['all4', 'Utility Player', 'Make it through camp at all four positions.'],
  ['tree', 'Coaching Tree', 'Tell Coach Okafor to chase her dream, and mean it.'],
  ['truck', 'Family Business', 'Get Mama Fonoti\'s food truck back on the road.'],
  ['crown', 'Heavy Is the Head', 'Turn Dante Kingsley from rival into friend.'],
];

const ITEMS = {
  luck: ['Rabbit\'s foot', 'Turns one bad play into a good one, then it\'s gone.'],
  notes: ['Vane\'s notes', 'Film notes on every read, every week.'],
  blitz: ['Blitz the dog', '+2 Confidence every week. Recovery days restore more energy.'],
  band: ['Vane\'s wristband', 'Bigger window on clutch plays.'],
};

// ---------- Weekly activities ----------
const ACTS = [
  { id: 'train', name: 'Extra reps', desc: () => POS[S.pos].train, chips: [['+Skill', 'up'], ['−Energy', 'down']],
    run: () => { fx({ skill: ri(3, 5), energy: -16 }); return pick([`{coachLast} walks by, stops, and watches three reps without saying anything. Then {cp} nods once.`, `Your body is sore in places you didn't know had muscles. That's how you know it worked.`, `By the end you can do it with your eyes closed. You know because Tiny made you try.`]); } },
  { id: 'film', name: 'Film room', desc: () => `Break down this week's opponent with {coach}. Unlocks film notes on your reads this week.`, chips: [['+Skill', 'up'], ['+Coaches', 'up'], ['Film notes', 'up']],
    run: () => {
      S.wk.film = true; fx({ skill: 1, coach: 4, energy: -5 });
      const i = ri(0, 2);
      if (i === 1) S.flags.film41 = true; // the reference check (ok_ref) may call back to this one
      return [`You notice their safety taps his helmet every time they're about to blitz. {coachLast} writes it on the whiteboard and underlines it twice.`, `{coachLast} pauses the tape forty-one times. You take notes on all forty-one.`, `You find a tendency: on third down, they bring pressure seven times out of ten.`][i];
    } },
  { id: 'rest', name: 'Recovery day', desc: () => `Cold tub, massage, and nine hours of sleep.${S.items.blitz ? ' Blitz insists on a long walk.' : ''}`, chips: [['+Energy', 'up'], ['+Confidence', 'up']],
    run: () => { fx({ energy: 26 + (S.items.blitz ? 8 : 0), conf: 2 }); return pick([`You sleep eleven hours and wake up feeling brand new.`, `The massage therapist finds a knot in your back that has its own zip code.`, `Ice bath, sauna, ice bath. You can't tell if it works. You feel great.`]); } },
  { id: 'team', name: 'Hang with the guys', desc: () => `Team chemistry is built off the field. Usually somewhere with food.`, chips: [['+Chemistry', 'up'], ['+Confidence', 'up']],
    run: () => { fx({ chem: 7, conf: 2, energy: -5 }); return pick([`Bowling night with the offensive line. Tiny bowls a 61 and celebrates every pin like a touchdown.`, `Tiny fires up a grill in the parking lot. Forty guys show up. Somebody brings a speaker the size of a refrigerator.`, `A video game tournament gets out of hand. Coach Bramble walks in, watches for ten seconds, and leaves without a word.`, `Escape room with the rookies. You don't escape. You do bond.`]); } },
  { id: 'media', name: 'Make some content', desc: () => `Post a video. Go on a podcast. Feed the algorithm.`, chips: [['+Fame', 'up'], ['Risky', 'lock']],
    run: () => { if (chance(0.25)) { fx({ fame: 6, chem: -4 }); return `The video does great numbers. A few veterans start calling you "Hollywood," and they don't mean it nicely.`; } fx({ fame: 7 }); return pick([`Your "day in the life" video gets 400,000 views. Most of the comments are about how your apartment has no furniture.`, `You go on a podcast and tell the story of draft night. The host tears up. So does the sound guy.`, `Your trick-shot video, a football into a trash can from the upper deck, goes viral.`]); } },
  { id: 'home', name: 'Call {fam}', desc: () => `An hour on the phone with {fam}. You always come back lighter.`, chips: [['+Confidence', 'up'], ['+Family', 'up']],
    run: () => { fx({ conf: 6, family: 6, energy: 4 }); return { town: `Grandma Bea puts you on speaker so the whole diner can say hi. Somebody yells that the pie is half off in your honor.`, city: `Mom calls on her break between patients. She has nine minutes. She spends all nine asking whether you're eating vegetables.`, base: `Dad asks about your footwork, your sleep schedule, and whether you've been making your bed. You have not been making your bed.` }[S.origin]; } },
  { id: 'gig', name: 'Paid appearance', desc: () => `Sign autographs at a car dealership and smile for photos.`, chips: [['+Money', 'up'], ['+Fame', 'up'], ['−Energy', 'down']],
    req: () => S.st.fame >= 25 || !!S.flags.agent, lock: 'Needs 25 Fame or an agent',
    run: () => { const m = S.flags.agent === 'sly' ? 2 : S.flags.agent === 'steady' ? 1.3 : 1; const pay = Math.round(ri(9, 16) * 1000 * m / 100) * 100; fx({ money: pay, fame: 2, energy: -10 }); return pick([`A man brings forty footballs for you to sign. You sign all forty. He thanks you and leaves with a hand truck.`, `You film a commercial for a mattress store. Your line is "I sleep like a champion." It takes nineteen takes.`, `You cut a ribbon at a new car wash. They give you a lifetime pass and a giant pair of scissors.`]); } },
  { id: 'mentor', name: 'Study with Vane', desc: () => `Sit with Marcus Vane and a tablet full of film.`, chips: [['+Skill', 'up'], ['+Vane', 'up']],
    req: () => S.rel.vane >= 15, lock: 'Needs Vane 15+',
    run: () => { fx({ skill: 4, vane: 4, energy: -7 }); return pick([`Vane shows you how to read a defense from the way the safety stands. You will never unsee it.`, `Vane rewinds one play nine times. "See it yet?" On the ninth time, you do.`, `Vane tells you about his rookie year: two cuts, one bus ticket home, and a phone call he almost didn't answer. It sounds familiar.`]); } },
];

// ---------- Random events (each can happen once per career) ----------
// Choices set S.flags.<event> so later pages can call back to what you did.
const EVENTS = {
  viral: { title: 'Two Million Views', body: [
      `Somebody films you doing a victory dance in the locker room. It's a dance {fam} taught you when you were seven. By morning it has two million views.`,
      `Your phone will not stop buzzing.`],
    choices: [
      { label: 'Lean in. Post a tutorial.', do() { S.flags.viral = 'post'; fx({ fame: 10, conf: 3, chem: -2 }); return [`The tutorial gets more views than the original. A few veterans do the dance ironically at practice. Then they do it un-ironically.`]; } },
      { label: 'Teach the whole offensive line the dance.', do() { S.flags.viral = 'line'; fx({ chem: 8, fame: 6 }); return [`Tiny cannot dance. It doesn't matter. The video of Tiny doing the shuffle gets more views than yours did.`]; } },
      { label: 'Say nothing and keep your head down.', do() { S.flags.viral = 'quiet'; fx({ coach: 4 }); return [`Bramble passes you in the hallway. "Saw the dance." That's it. That's all he says. You think it might have been a compliment.`]; } },
    ] },
  fender: { title: 'Crunch', body: [
      `Backing out of the players' lot, you hear a crunch. You've dented a lifted pickup truck.`,
      `It's Tiny's pickup truck. The one with TINY airbrushed across the tailgate in flames.`],
    choices: [
      { label: 'Find Tiny and confess.', do() { S.flags.fender = 'confess'; fx({ chem: 5, money: -87 }); return [{ s: 'Tiny', t: `Bro, that truck's been hit by worse. My cousin backed into it with a boat. Buy me lunch and we're good.` }, `Lunch costs you $87. Tiny orders four entrees and leaves the dent exactly where it is. "Character," he says.`]; } },
      { label: 'Leave a note with your number.', do() { S.flags.fender = 'note'; fx({ chem: 2, money: -3000 }); return [`Tiny texts you a photo of the note with eleven crying-laughing faces. Then he sends you the body shop bill.`]; } },
      { label: 'Drive away. Fast.', do() { if (chance(0.6)) { S.flags.fender = 'caught'; fx({ chem: -10, conf: -3 }); return [`The players' lot has nine security cameras. By lunch, the footage is on the locker room TV with dramatic music added. Tiny doesn't talk to you for two days.`]; } S.flags.fender = 'fled'; fx({ conf: -4 }); return [`Nobody finds out. You feel terrible about it every time Tiny smiles at you.`]; } },
    ] },
  dinner: { if: () => S.slate <= 5, title: 'The Rookie Dinner', body: [
      `It's a league tradition. The veterans take the rookies to the most expensive steakhouse in Harbor City, order everything on the menu, and hand the rookies the check.`,
      `The check is $28,450. The waiter sets it down in front of you, specifically. One veteran ordered a single steak that cost $400. He ate half of it.`],
    choices: [
      { if: () => S.st.money >= 28450, label: 'Pay it with a smile.', do() { S.flags.dinner = 'paid'; fx({ money: -28450, chem: 10, vane: 5 }); return [S.rel.vane >= 30 ? `The veterans give you a standing ovation. Vane raises his glass and says, loud enough for the whole table: "That's my rookie."` : `The veterans give you a standing ovation. Vane raises his glass in your direction, which is the first time he's acknowledged your existence in public.`]; } },
      { label: 'Split it with the other rookies.', do() { S.flags.dinner = 'split'; fx({ money: -5690, chem: 4 }); return [`Five rookies, one calculator, and a lot of math on a napkin. It comes to $5,690 each. Fair is fair.`]; } },
      { label: 'Refuse to pay.', do() { S.flags.dinner = 'refused'; fx({ chem: -12, conf: 3 }); return [`The next morning you find your car on the practice field, at the fifty-yard line, wrapped in four hundred feet of athletic tape.`]; } },
    ] },
  club: { title: 'Club Velvet', body: [
      `The group chat lights up two nights before the game. Big night at Club Velvet, and the DJ is somebody famous.`],
    choices: [
      { label: 'Go, but leave at eleven.', do() { S.flags.club = 'early'; fx({ chem: 4, energy: -5 }); return [`You dance, you laugh, you leave at 10:58. Responsible and fun. {coachLast} would be proud, if you ever told {cobj}.`]; } },
      { label: 'Go and stay out all night.', do() { if (chance(0.4)) { S.flags.club = 'photo'; fx({ chem: 6, energy: -24, coach: -10 }); return [`Somebody posts a photo of you on top of a booth at 3 a.m. Bramble has it printed and taped to your locker by 7.`]; } S.flags.club = 'late'; fx({ chem: 6, energy: -24 }); return [`Legendary night. You feel it in your bones the entire next day.`]; } },
      { label: 'Stay home. Cold tub. Bed.', do() { S.flags.club = 'home'; fx({ energy: 14, coach: 2 }); return [`You're asleep by 9:30. The group chat has 214 messages when you wake up. You read none of them.`]; } },
    ] },
  pep: { title: 'The Old Gym',
    get body() {
      return [{
        town: `Coach Delgado calls from Cutter's Ford. Your old high school wants you to speak at Friday's pep rally. It's your day off, but it's a long trip back to Kansas.`,
        city: `Coach Delgado, your old high school coach, calls. The school wants you to speak at Friday's pep rally. It's your day off, and the east side is eleven miles and one bridge away.`,
        base: `Coach Delgado calls. He coached you for one season, at the last of your six high schools, and he still tells people you were the hardest worker he ever had. They want you at Friday's pep rally. It's your day off, but it's a long flight to Texas.`,
      }[S.origin]];
    },
    get choices() {
      return [
        { label: S.origin === 'city' ? 'Drive over and do it in person.' : 'Fly back and do it in person.', do() { S.flags.pep = 'went'; fx({ energy: S.origin === 'city' ? -6 : -12, fame: 5, family: 8, conf: 5 }); return [`The gym is packed. Coach Delgado introduces you and gets choked up halfway through. {fam} sits in the front row and films the whole thing sideways.`]; } },
        { label: 'Record a video message.', do() { S.flags.pep = 'video'; fx({ fame: 3, family: 3 }); return [`You film it in the locker room. Tiny photobombs it. The kids love Tiny more than you, honestly.`]; } },
        { label: 'Politely decline.', do() { S.flags.pep = 'no'; fx({ energy: 5 }); return [`You send a signed jersey instead. It hangs in the trophy case by Monday.`]; } },
      ];
    } },
  rabbit: { title: 'The Superfan', body: [
      `At an autograph line, a woman in a foam shark hat presses something into your hand. It's a rabbit's foot on a key ring.`,
      { s: 'Superfan', t: `My dad carried this to every Hammerheads game for thirty years. He'd want a player to have it. Keep it in your sock.` }],
    choices: [
      { label: 'Keep it. You need all the luck you can get.', do() { S.flags.rabbit = 'kept'; S.items.luck = true; fx({ conf: 2 }); return [`You tuck it into your sock. It's a little gross. It also feels like it might work.`, { note: 'New item: Rabbit\'s foot. It will turn one bad play into a good one, then it\'s gone.' }]; } },
      { label: 'Thank her, but give it back.', do() { S.flags.rabbit = 'returned'; fx({ conf: 2, fame: 2 }); return [`She tears up. "You're a good kid." She posts about it online, and it's the nicest thing anyone says about you all week.`]; } },
    ] },
  zapp: { if: () => S.st.fame >= 15, title: 'ZAPP!', body: [
      `ZAPP! Hydration wants you in a commercial. They're offering $40,000.`,
      `You taste the product. It tastes like a battery dipped in blue raspberry.`],
    choices: [
      { label: 'Do it and smile big.', do() { S.flags.zapp = 'smile'; fx({ money: 40000, fame: 6 }); return [`"ZAPP! Hydration. Taste the win." You say it forty times. You never actually swallow.`]; } },
      { label: 'Do it, but improvise an honest line.', do() { if (chance(0.5)) { S.flags.zapp = 'honest'; fx({ money: 40000, fame: 12 }); return [`"It tastes like a battery, but I've never cramped once." They keep it. It becomes the most-shared ad of the season.`]; } S.flags.zapp = 'half'; fx({ money: 20000, fame: 2 }); return [`They do not keep it. They pay you half and use a stunt double for the drinking shot.`]; } },
      { label: 'Turn it down.', do() { S.flags.zapp = 'no'; fx({ conf: 2 }); return [`You stick to water. Tiny takes the commercial instead and uses the money to buy his mom a second grill.`]; } },
    ] },
  fiveam: { title: 'Five A.M.', body: [
      { s: '{coach}', t: `Five a.m. tomorrow. Me, you, and the walkthrough field. It's optional.` },
      `{coachLast} says "optional" the way a dentist says "this won't hurt."`],
    choices: [
      { label: 'Be there at 4:45.', do() { S.flags.fiveam = 'early'; fx({ skill: 5, coach: 8, energy: -10 }); return [`{coachLast} is already there at 4:30. Of course {cp} is. But {cp} notices you came early, and {cp} notices that you noticed.`]; } },
      { label: 'Be there at 5:00 sharp.', do() { S.flags.fiveam = 'ontime'; fx({ skill: 3, coach: 3, energy: -8 }); return [`On time is on time. You get forty minutes of footwork before the sun comes up.`]; } },
      { label: 'Sleep in. It said optional.', do() { S.flags.fiveam = 'slept'; fx({ energy: 10, coach: -5 }); return [`{coachLast} doesn't mention it. That's somehow worse.`]; } },
    ] },
  troll: { title: '@HammerheadsHater69', body: [
      `An account called @HammerheadsHater69 posts your worst play of the season in slow motion with clown music. It has a million views.`],
    choices: [
      { label: 'Reply with a joke at your own expense.', do() { S.flags.troll = 'joke'; fx({ fame: 6, conf: 2 }); return [`"The clown music is actually what plays in my head on every snap." It gets more likes than the original. The account deletes itself.`]; } },
      { label: 'Clap back hard.', do() { S.flags.troll = 'clap'; fx({ fame: 4, coach: -4, conf: 1 }); return [`It turns into a three-day news story. Bramble makes you run stadium stairs while holding your phone.`]; } },
      { label: 'Log off.', do() { S.flags.troll = 'off'; fx({ conf: 3, energy: 5 }); return [`You delete the app for the weekend. You read a whole book. It's about sharks, which feels appropriate.`]; } },
    ] },
  hammy: { title: 'A Twinge', body: [
      `Thursday practice. You plant to cut and feel a twinge in the back of your leg. Probably nothing. Probably.`],
    choices: [
      { label: 'Tell the trainers right away.', do() { S.flags.hammy = 'told'; fx({ energy: 10, coach: 3 }); return [`Dr. Imani Shaw tapes it, ices it, and tells you it's minor. Bramble says, "Smart." It's the first time he's ever said that word to you.`]; } },
      { label: 'Play through it.', do() { S.flags.hammy = 'played'; if (chance(0.35)) { fx({ energy: -28, conf: -5 }); return [`By Friday you're limping. By Saturday you're a mess. You will be playing on one and a half legs Sunday.`]; } fx({ conf: 3 }); return [`It really was nothing. You feel tough about it, even though you were mostly lucky.`]; } },
      { label: 'Try Tiny\'s auntie\'s secret ointment.', do() { S.flags.hammy = 'ointment'; fx({ energy: 6, chem: 4 }); return [`It smells like a campfire and cinnamon. It works shockingly well. You do not ask what's in it.`]; } },
    ] },
  song: { if: () => S.slate <= 5, title: 'Rookie Song', body: [
      `Team dinner tradition: every rookie stands on a chair and sings. Tonight is your night. Fifty-three men put down their forks.`],
    choices: [
      { label: 'Go all in on a power ballad.', do() { S.flags.song = 'ballad'; if (S.st.conf >= 50) { fx({ chem: 9, fame: 2 }); return [`You hit the high note. You actually hit it. Tiny cries. Bramble does not cry, but he does stop eating.`]; } fx({ chem: 6 }); return [`Your voice cracks on the big note. Somehow that makes it better. They make you do it again.`]; } },
      { label: 'Mumble through the fight song.', do() { S.flags.song = 'mumble'; fx({ chem: -2 }); return [`Fifty-three men boo you, lovingly. They throw dinner rolls. You catch one.`]; } },
      { label: 'Pull Tiny up for a duet.', do() { S.flags.song = 'duet'; fx({ chem: 7, conf: 3 }); return [S.flags.karaoke === 'all' ? `It's the Rusty Anchor all over again, with better acoustics. The two of you get a standing ovation and a noise complaint from the hotel.` : `Tiny knows all the words to every song ever written. The two of you get a standing ovation and a noise complaint from the hotel.`]; } },
    ] },
  // Only on a road trip: the week's game has to be away.
  cards: { if: () => venueOf(S.slate) === 'away', title: 'Bourré on the Plane', body: [
      `On the team plane, the veterans play Bourré, a Cajun card game that has been played on football flights for decades. There's an empty seat at the table.`],
    choices: [
      { if: () => S.st.money >= 5000, label: 'Buy in for $5,000.', do() { if (chance(0.5)) { S.flags.cards = 'won'; fx({ money: 15000, chem: 3 }); return [`Beginner's luck. You win $15,000 and the veterans demand a rematch on every flight for the rest of the season.`]; } S.flags.cards = 'lost'; fx({ money: -5000, chem: 3 }); return [`You lose all of it in four hands. The veterans thank you for your contribution.`]; } },
      { label: 'Watch and learn.', do() { S.flags.cards = 'watched'; fx({ chem: 2 }); return [`You learn the rules, the trash talk, and that you should never play cards with Tiny.`]; } },
      { label: 'Noise-canceling headphones. Sleep.', do() { S.flags.cards = 'slept'; fx({ energy: 10 }); return [`You wake up with drool on your shoulder and a mustache drawn on your face. Worth it.`]; } },
    ] },
  reporter: { if: () => S.flags.vaneHurt, title: 'The Question', body: [
      `Jules Park from the Harbor City Ledger catches you at your locker with a microphone.`,
      { s: 'Jules Park', t: `The fans are asking. With the way you've been playing, is this your team now?` }],
    choices: [
      { label: '"It\'s Marcus\'s team. I\'m keeping his seat warm."', do() { S.flags.reporter = 'humble'; fx({ vane: 10, coach: 2 }); return [`Vane watches the clip on his phone at his locker. He doesn't say anything, but he forwards it to his wife.`]; } },
      { label: '"I\'m here to win the job."', do() { S.flags.reporter = 'bold'; fx({ conf: 4, fame: 4, vane: -8 }); return [`It's the headline on the Ledger's website within an hour. Vane walks past your locker without looking at you.`]; } },
      { label: '"Ask me after Sunday."', do() { S.flags.reporter = 'later'; fx({ fame: 2, coach: 2 }); return [`Jules smiles. "I will." They will.`]; } },
    ] },
  dog: { title: 'Trespasser', body: [
      `During practice, a scruffy brown mutt squeezes under the fence, steals a football, and runs the length of the field with it. Nobody can catch him.`,
      `When he finally stops, he drops the ball at your feet and sits down like he's waiting for a play call.`],
    choices: [
      { label: 'Adopt him. His name is Blitz.', do() { S.flags.dog = 'blitz'; S.items.blitz = true; award('blitz'); fx({ conf: 5, fame: 3 }); return [`The vet says he's about two years old and "very fast for his size." Rocco, the equipment manager, makes him a tiny jersey with your number on it.`, { note: 'New item: Blitz. +2 Confidence every week, and recovery days restore more energy.' }]; } },
      { label: 'Find his owner.', do() { S.flags.dog = 'biscuit'; fx({ conf: 2, fame: 3 }); return [`His name is Biscuit. His owner is an eighty-year-old season-ticket holder who cries when you bring him home. She sends cookies every week for the rest of the season.`]; } },
    ] },
  helmets: { title: 'New Helmets', body: [
      `Coach Delgado, your old high school coach, calls. The program can't afford new helmets this year. Some of the kids are wearing ones older than they are.`],
    choices: [
      { if: () => S.st.money >= 25000, label: 'Write a check for $25,000.', do() { S.flags.helmets = 'check'; fx({ money: -25000, family: 8, fame: 5, conf: 3 }); return [`The kids send a team photo. Every one of them is wearing a new helmet and pointing at the camera.`]; } },
      { label: 'Organize a fundraiser with teammates.', do() { S.flags.helmets = 'fund'; fx({ energy: -10, fame: 6, chem: 4 }); return [`Tiny runs the grill. The fundraiser raises $31,000. Tiny eats about $400 of it.`]; } },
      { label: 'Not right now.', do() { S.flags.helmets = 'no'; fx({ conf: -2 }); return [`You tell yourself you'll do it next year. It nags at you anyway.`]; } },
    ] },
  car: { if: () => S.st.money >= 120000, title: 'The Showroom', body: [
      `A dealership is showing off a matte-orange sports car. It costs $150,000. The salesman says it "matches the pylons."`],
    choices: [
      { if: () => S.st.money >= 150000, label: 'Buy it.', sub: 'Costs $150,000', do() { S.flags.car = 'bought'; fx({ money: -150000, fame: 5, conf: 5 }); return [`It's incredible. It goes zero to sixty in three seconds. Tiny does not fit in it. You drive him to lunch anyway, with his head out the sunroof.`]; } },
      { label: 'Buy {fam} a sensible car instead.', sub: 'Costs $40,000', do() { S.flags.car = 'family'; fx({ money: -40000, family: 15, conf: 3 }); return [`{fam} cries in the parking lot, then asks about the gas mileage.`]; } },
      { label: 'Walk away.', do() { S.flags.car = 'walked'; fx({ coach: 2 }); return [`{coachLast} drives a 2009 minivan with 240,000 miles on it, and approves of your choice when you mention it.`]; } },
    ] },
  snow: { if: () => S.slate >= 7, title: 'Snow Week', body: [
      `A blizzard buries Harbor City. Bramble refuses to practice indoors.`,
      { s: 'Coach Bramble', t: `It might snow on Sunday. It might snow in January. We practice in it.` }],
    choices: [
      { label: 'Embrace it. Snow angels on the fifty.', do() { S.flags.snow = 'angels'; fx({ chem: 5, energy: -4 }); return [`Half the team joins in. Bramble watches from the sideline with his arms crossed. Is he smiling? Nobody can tell under the scarf.`]; } },
      { label: 'Focus on ball security in the cold.', do() { S.flags.snow = 'work'; fx({ skill: 3, coach: 3 }); return [`Wet ball, frozen hands. By the end of the week, cold doesn't bother you anymore.`]; } },
      { label: 'Complain about the cold.', do() { S.flags.snow = 'complain'; fx({ coach: -4, energy: 4 }); return [`Bramble hears you. You do up-downs in the snow until you stop complaining, then a few more after that.`]; } },
    ] },
  legend: { title: 'Hands Greer', body: [
      `Hollis "Hands" Greer, a retired Hammerheads legend with a bronze statue outside the stadium, runs a free clinic for kids on Tuesdays. He invites you.`],
    choices: [
      { label: 'Go.', do() { S.flags.legend = 'went'; fx({ fame: 4, skill: 2, conf: 4, energy: -8 }); return [`Forty kids, one legend, and you. Greer shows you a trick he's never told anyone.`, { s: 'Hands Greer', t: `Don't tell the defense.` }, `He winks. You will never tell the defense.`]; } },
      { label: 'Rest instead.', do() { S.flags.legend = 'rested'; fx({ energy: 6 }); return [`You watch clips of the clinic online. The kids look like they had a blast.`]; } },
    ] },
};
// Slate 9 hosts the family finale beat, so its random event moved to the first playoff week.
const RANDOM_SLATES = [1, 2, 5, 8, 10];

// ---------- Story pages ----------
const P = {};

P.draft = () => ({
  kicker: 'Draft night · Round 7, pick 257',
  title: 'Mr. Irrelevant Is Somebody Else',
  body: [
    `The last pick of the draft scrolls across the bottom of the TV. It's a kicker from a school you've never heard of. The commissioner mispronounces his name, and the crowd cheers anyway. They call the last pick "Mr. Irrelevant." Even he got a phone call tonight.`,
    `Two hundred and fifty-seven names got called this weekend. Yours wasn't one of them.`,
    `Your phone is face-down on the couch cushion. It hasn't buzzed in four hours. {fam} is in the kitchen, washing a pan that was clean an hour ago.`,
  ],
  choices: [
    { label: 'Turn off the TV and go run sprints in the dark.', do() { S.flags.draftNight = 'sprints'; fx({ skill: 3, energy: -5 }); return [`You run forty-yard sprints under the streetlights until your lungs burn. Every time you cross the line, you say the name of somebody who got picked ahead of you. You run out of breath before you run out of names.`]; }, then: 'call' },
    { label: 'Go sit with {fam} in the kitchen.', do() { S.flags.draftNight = 'kitchen'; fx({ family: 8, conf: 3 }); return [{ s: '{fam}', t: `They'll be sorry. Every one of them. Now eat something.` }, `You eat cold mac and cheese out of the pan. It's the best thing you've ever tasted.`]; }, then: 'call' },
    { label: 'Screenshot every analyst who called you a "camp body."', do() { S.flags.draftNight = 'receipts'; fx({ conf: 5 }); return [`You make a folder on your phone called RECEIPTS. It has nineteen screenshots in it. You set the meanest one as your lock screen.`]; }, then: 'call' },
  ],
});

P.call = () => ({
  kicker: 'Draft night · 11:52 PM',
  title: 'Unknown Number',
  body: [
    `At 11:52, the phone buzzes. Unknown number, Harbor City area code.`,
    { s: 'Coach Okafor', t: `{first} {last}? This is Nina Okafor, {poscoach} for the Harbor City Hammerheads. We watched your tape. We want you at camp. It's a tryout contract with no guarantees. ${S.origin === 'city' ? 'Be at the facility at six a.m. I know you live eleven miles away. Be early anyway.' : 'Your flight leaves at six a.m.'}` },
    `Behind you, {fam} has gone completely still. Dishwater drips onto the floor.`,
  ],
  choices: [
    { label: '"Yes, ma\'am. I\'ll be there before you are."', do() { S.flags.callAns = 'yes'; fx({ conf: 5, coach: 2 }); return [{ s: 'Coach Okafor', t: `I get there at four-thirty. Good luck.` }, `She hangs up. {fam} screams loud enough to set off a car alarm outside.`]; }, then: 'camp1' },
    { label: '"Thank you. I won\'t let you down."', do() { S.flags.callAns = 'thanks'; fx({ coach: 6 }); return [{ s: 'Coach Okafor', t: `Don't thank me. Show me.` }, `She hangs up. You stare at the phone for a full minute before you remember to breathe.`]; }, then: 'camp1' },
    { label: '"What\'s the signing bonus?"', do() { S.flags.callAns = 'bonus'; fx({ money: 2500, coach: -4 }); return [`There's a long pause on the line.`, { s: 'Coach Okafor', t: `Twenty-five hundred dollars. That's more than most of the guys we called tonight got.` }, `You take it. It's the most money you've ever had at one time.`]; }, then: 'camp1' },
  ],
});

P.camp1 = () => ({
  kicker: 'Training camp · Day 1',
  title: 'The Locker Between Two Giants',
  body: [
    `The Hammerheads facility smells like cut grass, rubber mats, and money. Ninety players are in camp. Fifty-three will make the team.`,
    `Your locker is a plywood stall with a strip of tape that says {LAST} in marker. On your left sits a man roughly the size of a vending machine, eating cereal out of a mixing bowl.`,
    { s: 'Tiny', t: `Tavita Fonoti. Everybody calls me Tiny. Don't ask why. You want some cereal? I got a whole box in my truck.` },
    `On your right is a locker with a brass nameplate: VANE, #{vnum}. Eleven seasons, two Pro Bowls, and a poster that hung above your bed when you were twelve years old.`,
    `Marcus Vane walks in, looks at the tape on your locker, and says nothing at all.`,
  ],
  choices: [
    { label: 'Tell Vane you had his poster on your wall as a kid.', do() { S.flags.locker = 'poster'; fx({ vane: 6, conf: -1 }); return [{ s: 'Marcus Vane', t: `Great. Now I feel old. Was it the one with the frosted tips?` }, `You nod. He shakes his head, but you catch the corner of his mouth moving.`]; }, then: 'camp_drill' },
    { label: 'Introduce yourself with a firm handshake.', do() { S.flags.locker = 'hand'; fx({ vane: 2, conf: 3 }); return [`He shakes your hand without standing up.`, { s: 'Marcus Vane', t: `Firm grip. Plenty of guys with firm grips get cut, rookie.` }]; }, then: 'camp_drill' },
    { label: 'Ask Vane for one piece of advice.', do() { S.flags.locker = 'advice'; fx({ vane: -3, skill: 3 }); return [{ s: 'Marcus Vane', t: `Advice? Don't take my job.` }, `Then, quieter, without looking up:`, { s: 'Marcus Vane', t: `And stop looking at your feet when you {verb}.` }, `You've never noticed that you do that. You do that.`]; }, then: 'camp_drill' },
    { label: 'Sit down next to Tiny and eat cereal.', do() { S.flags.locker = 'cereal'; fx({ chem: 6 }); return [`Best decision you've made all year. Tiny tells you which coaches yell, which ones whisper, and which one you should be scared of. (The one who whispers.)`]; }, then: 'camp_drill' },
  ],
});

P.camp_drill = () => ({
  kicker: 'Training camp · Day 1 · Afternoon',
  title: 'The Forty',
  body: [
    `Head coach Ray Bramble has a whistle, a clipboard, and a face like a closed fist. He has been coaching since before you were born, and he has never once said "good job" to anyone.`,
    { s: 'Coach Bramble', t: `Rookies. Forty-yard dash. Electronic timing. Anybody who false-starts runs it again with the whole team watching.` },
    `You settle into your stance. Somewhere in the stands, a scout clicks a stopwatch.`,
  ],
  mini: { type: 'reaction', diff: 1.2, fakes: 1, label: 'Get off', prompt: 'Explode on the orange GO. Not before.', btnText: 'Get set',
    onDone(r) {
      S.camp += { great: 3, good: 2, bad: 0 }[r];
      fx(r === 'great' ? { conf: 4 } : r === 'bad' ? { conf: -3 } : { conf: 1 });
      const body = { great: [`4.41 seconds. Bramble looks at the stopwatch, then at you, then writes something down. It's the first thing he's written all day.`], good: [`4.55. Solid. Nobody gasps, but nobody laughs either.`], bad: [`You flinch early. The whistle shrieks. You run it again with ninety guys watching, and Bramble writes nothing down.`] }[r];
      go('_result', { body, next: 'camp_night', kicker: 'Training camp · Day 1' });
    } },
});

P.camp_night = () => ({
  kicker: 'Training camp · Day 2 · Night',
  title: 'Karaoke at the Rusty Anchor',
  body: [
    `Day two is a blur of install meetings. The playbook is three hundred pages long and written like a tax form.`,
    `At 8 p.m., Tiny kicks open your dorm door.`,
    { s: 'Tiny', t: `Rookies are doing karaoke at the Rusty Anchor. Curfew's at eleven. Come on. I'm doing a power ballad and I need a backup singer.` },
  ],
  choices: [
    { label: 'Go, and sing backup like your life depends on it.', do() { S.flags.karaoke = 'all'; fx({ chem: 8, energy: -8 }); if (chance(0.3)) { S.flags.karaokeFine = true; fx({ coach: -6, money: -1000 }); return [`You and Tiny bring the house down. You also get back at 11:04. Bramble's assistant is standing in the hallway with a clipboard and a $1,000 fine.`]; } return [`You and Tiny bring the house down. You're back at 10:58, still humming.`]; }, then: 'camp_scrim' },
    { label: 'Go for one song, then go study.', do() { S.flags.karaoke = 'one'; fx({ chem: 4, skill: 2, energy: -4 }); return [`One song, a round of applause, and you're back with the playbook by nine. Tiny calls you "Professor" for a week.`]; }, then: 'camp_scrim' },
    { label: 'Stay in and learn the playbook.', do() { S.flags.karaoke = 'study'; S.camp += 1; fx({ skill: 4, coach: 4 }); return [`By midnight you know every play in the first hundred pages. The next morning Okafor quizzes the room, and you're the only rookie who gets them all right.`]; }, then: 'camp_scrim' },
    { label: 'Call {fam}.', do() { S.flags.karaoke = 'call'; fx({ conf: 5, family: 5 }); return [`{fam} makes you describe everything: the locker room, the food, the coaches, Tiny. Especially Tiny.`]; }, then: 'camp_scrim' },
  ],
});

P.camp_scrim = a => {
  const i = a.i || 0;
  const m = MOMENTS[S.pos][S.flags.scrim[i]];
  const intro = i === 0
    ? [`Day three is the scrimmage. Full pads, live hitting, and every coach in the building up in the stands with a clipboard.`, { s: 'Coach Okafor', t: `{last}, you're in. Show me something.` }]
    : [`One more rep before the scrimmage ends. You can feel the coaches watching.`];
  return {
    kicker: 'Training camp · Day 3 · Scrimmage',
    title: i === 0 ? 'Live Bullets' : 'Last Rep',
    body: intro.concat([m.setup]),
    mini: Object.assign(miniCfg(m, 1.3 + i * 0.4), {
      onDone(r, x) {
        S.camp += { great: 3, good: 2, bad: 0 }[r];
        fx({ great: { conf: 3, coach: 3 }, good: { conf: 1, coach: 1 }, bad: { conf: -3 } }[r]);
        const react = { great: `Okafor writes something on her clipboard and underlines it.`, good: `A nod from Okafor. You'll take it.`, bad: `Bramble's whistle. "Again!" You can feel ninety guys watching.` }[r];
        go('_result', { body: [x && x.text ? x.text : fmtMoment(m, r), react], next: i === 0 ? { id: 'camp_scrim', args: { i: 1 } } : 'cut', kicker: 'Training camp · Day 3' });
      },
    }),
  };
};

P.cut = () => ({
  kicker: 'Cut day · 6:40 AM',
  title: 'The Turk',
  body: [
    `Every team has a Turk. He's the staffer who finds you on cut day, taps you on the shoulder, and says: *Coach wants to see you. Bring your playbook.*`,
    `If he says the second part, you're done. You hand the playbook back, and you go home.`,
    `You're eating eggs you can't taste when you feel the tap.`,
    { s: 'The Turk', t: `{last}. Coach wants to see you.` },
    `You wait for the second part. Across the table, Tiny stops chewing.`,
  ],
  choices: [{ label: 'Walk to Coach Bramble\'s office.', do() { if (S.flags.made == null) S.flags.made = campScore() >= 6; return null; }, then: 'cut_result' }],
});

P.cut_result = () => (S.flags.made ? {
  kicker: 'Cut day',
  title: 'Fifty-Three',
  body: [
    `He doesn't say it.`,
    `Bramble's office smells like coffee and old film. He doesn't look up from his desk.`,
    { s: 'Coach Bramble', t: `You made the fifty-three. Backup {pos} behind Marcus Vane. Don't make me regret it.` },
    `That's the whole meeting. In the hallway, Tiny lifts you off the ground like you weigh nothing, which, to Tiny, you do.`,
  ],
  choices: [{ label: 'Start the season', primary: true, do() { campDone(); return null; } }],
} : {
  kicker: 'Cut day',
  title: 'Practice Squad',
  body: [
    `He says it. *Bring your playbook.*`,
    `You carry the playbook down the hall like it weighs a thousand pounds. Bramble takes it without looking up.`,
    { s: 'Coach Bramble', t: `You're cut. Tomorrow we sign you to the practice squad. You practice with us, but you don't dress on Sundays. Okafor went to bat for you. Make her look smart.` },
    `It isn't the roster. But it isn't home, either.`,
  ],
  choices: [{ label: 'Start the season', primary: true, do() { campDone(); return null; } }],
});

// ---------- Fixed weekly story beats ----------
P.w1_family = () => {
  const o = S.origin;
  const setup = {
    town: `Grandma Bea hasn't closed the Bluebird Diner on a Sunday in thirty-one years. Sunday is pancake day. Pancake day pays the electric bill. And flights from Kansas aren't cheap on a week's notice.`,
    city: `Mom lives eleven miles away, but she works Sundays. To come, she'd have to trade away a twelve-hour shift and owe somebody a holiday. Covering it costs real money.`,
    base: `Dad retired to a little house in Texas, a short drive from the last base. Flights aren't cheap on a week's notice. And Dad hasn't been inside a stadium since he came home from his last deployment. He says it's the parking. You both know it isn't.`,
  }[o];
  const bring = {
    town: [`Grandma Bea tapes a sign to the Bluebird's door: CLOSED SUNDAY. FIRST TIME IN 31 YEARS. GO HAMMERHEADS. Half the town drives by just to take a picture of it.`, `She arrives with a homemade sign that says {LAST} IS MY GRANDBABY, in glitter, in letters three feet tall.`],
    city: [`Mom trades her Sunday for two overnight shifts next week. She arrives in scrubs under her good coat, holding a homemade sign that says {LAST} IS MY KID in letters you can read from the upper deck.`],
    base: [`Dad flies in. He makes it as far as the stadium parking lot.`, `He watches the whole game on his phone in the rental car, with the windows down so he can hear the real crowd. He texts you after every series. *Good.* *Good.* *Eyes up.*`],
  }[o];
  const coach = {
    town: `Coach Delgado drives nine hours from Cutter's Ford to be there. He sends you a selfie from the parking lot at 6 a.m.`,
    city: `Coach Delgado takes two buses across town to be there. He sends you a selfie from the parking lot at 6 a.m. The gates open at ten.`,
    base: `Coach Delgado coached you for exactly one season, at your sixth high school. He drives eleven hours anyway. He sends you a selfie from the parking lot at 6 a.m.`,
  }[o];
  const tv = {
    town: `"Of course, sugar. Next time." There's a pause on the line before "next time."`,
    city: `"Of course, baby. Next time." There's a pause on the line before "next time."`,
    base: `"Roger that. Next time." There's a pause before "next time." You can hear him deciding not to be disappointed.`,
  }[o];
  return {
    kicker: 'Week 1 · Home opener',
    title: 'Two Tickets',
    body: [
      `Players get two free tickets to every home game. {fam} has never seen you play as a pro.${S.role === 'practice' ? ' You won\'t even be in uniform, but {fam} doesn\'t care.' : ''}`,
      setup,
    ],
    choices: [
      { if: () => S.st.money >= 2400, label: 'Bring {fam} and get the good seats.', sub: 'Costs $2,400', do() { if (o === 'base') S.flags.dadLot = true; else S.flags.famAtGame = true; fx({ money: -2400, family: 10, conf: 5 }); return bring; }, then: 'queue' },
      { label: 'Give the tickets to Coach Delgado, your high school coach.', do() { S.flags.w1 = 'delgado'; fx({ fame: 3, conf: 2, family: -2 }); return [coach]; }, then: 'queue' },
      { label: 'Tell {fam} to watch on TV this time.', do() { S.flags.w1 = 'tv'; fx({ family: -4, energy: 4 }); return [tv]; }, then: 'queue' },
    ],
  };
};

P.w2_callup = () => ({
  kicker: 'Week 2 · Tuesday',
  title: 'The Call-Up',
  body: [
    `Tuesday morning, the backup {pos} pulls a hamstring in a walkthrough. A walkthrough. Nobody even runs in a walkthrough.`,
    `Okafor finds you in the cafeteria.`,
    { s: 'Coach Okafor', t: `You're on the fifty-three. Congratulations. Now go find Rocco in the equipment room and get a real jersey.` },
  ],
  choices: [
    { label: 'Call {fam} from the parking lot.', do() { S.role = 'backup'; fx({ family: 6, conf: 4 }); return [`You can't get the words out at first. {fam} figures it out anyway.`]; }, then: 'queue' },
    { label: 'Go straight to the film room.', do() { S.role = 'backup'; fx({ skill: 3, coach: 4 }); return [`Okafor finds you there an hour later. She doesn't say anything. She just turns the lights off so you can see the screen better.`]; }, then: 'queue' },
  ],
});

P.w4_rehab = () => ({
  kicker: 'Week 4 · Training room',
  title: 'The Boot',
  body: [
    `Vane has a high ankle sprain. Four weeks, maybe five. He spends his days in the training room in a walking boot. During film sessions he watches you on the big screen with his arms crossed.`,
    `Thursday after practice, you find him alone by the cold tubs, staring at a playbook he knows by heart.`,
  ],
  choices: [
    { label: 'Ask him to coach you.', do() {
        S.flags.rehab = 'coach';
        if (S.rel.vane >= 0) { S.items.notes = true; fx({ skill: 5, vane: 12 }); return [`He looks at you for a long time.`, { s: 'Marcus Vane', t: `Fine. Sit down. You're doing seven things wrong.` }, `It turns out to be eleven things. By the time you leave, it's dark out, and you have three pages of notes in his handwriting.`, { note: 'New item: Vane\'s notes. You\'ll see film notes on every read, every week.' }]; }
        fx({ skill: 2, vane: 8 }); return [{ s: 'Marcus Vane', t: `You want me to help you take my job?` }, `He laughs without smiling. But the next morning there's a sticky note on your locker with three bullet points in tiny handwriting. All three are right.`];
      }, then: 'queue' },
    { label: 'Bring him a plate of Tiny\'s barbecue and talk about anything but football.', do() { S.flags.rehab = 'bbq'; fx({ vane: 15, chem: 3 }); return [`He talks about his kids, his knees, and his first coach, who cut him twice before he made it. You talk about {fam}. Neither of you mentions the depth chart.`]; }, then: 'queue' },
    { label: 'Leave him alone. He wouldn\'t want company.', do() { S.flags.rehab = 'alone'; fx({ vane: -5, energy: 5 }); return [`You go home early and sleep well. Vane eats his lunch alone in the training room again.`]; }, then: 'queue' },
  ],
});

P.w5_trash = () => ({
  kicker: 'Week 5 · Rivalry week',
  title: 'The Crown',
  body: [
    `Monarchs week. On his podcast, Dante Kingsley, an All-Pro {king} with a crown tattoo and eleven million followers, spends four minutes talking about you.`,
    { s: 'Dante Kingsley', t: `Who? The undrafted kid? Man, I didn't know you could just walk into this league. Did they hold a raffle? I'm gonna make him famous Sunday. For all the wrong reasons.` },
    `The clip has two million views by lunch. Your phone is warm to the touch.`,
  ],
  choices: [
    { label: 'Fire back: "Bring your crown Sunday. I\'ll bring a receipt."', do() { S.flags.trash = 'fire'; danteAdd(0, 2); fx({ fame: 10, conf: 4, coach: -4 }); return [`The internet explodes. Sports talk shows argue about it for two days. Bramble pins the clip to the locker room wall, and you can't tell if it's a warning or a compliment. The Monarchs will be fired up.`, arcNote('Kingsley')]; }, then: 'queue' },
    { label: 'Post a photo of a crown-shaped cake: "Congrats on the podcast!"', do() { S.flags.trash = 'cake'; danteAdd(1, 0); fx({ fame: 7, chem: 4 }); return [`Tiny ate most of the cake for the photo. The post gets more likes than Kingsley's clip. Even some Monarchs fans think it's funny.`, arcNote('Kingsley')]; }, then: 'queue' },
    { label: 'Say nothing. Pin the clip inside your locker.', do() { S.flags.trash = 'quiet'; danteAdd(1, 0); S.flags.focus = true; fx({ conf: 6, coach: 4 }); return [`You watch it every morning. You don't say a word all week. Okafor notices, and she puts in extra film time with you.`, { note: 'Locked in: you\'ll have film notes on your reads this week.' }]; }, then: 'queue' },
  ],
});

P.w6_agent = () => ({
  kicker: 'Week 6',
  title: 'Sly',
  body: [
    `Sly Pemberton has a convertible, a fresh manicure, and a business card made of metal.`,
    { s: 'Sly Pemberton', t: `Kid, you're a story. Undrafted, overlooked, chip on the shoulder? Sponsors eat that up with a spoon. Sign with me and you'll have three endorsement deals by Thanksgiving. Standard three percent.` },
  ],
  choices: [
    { label: 'Sign with Sly.', do() { S.flags.agent = 'sly'; fx({ money: 30000, fame: 6, chem: -3 }); return [`Within a week you have a shoe deal, a cereal box, and a $30,000 signing check. Tiny turns the metal card over in his huge hands. "Bro," he says. That's all he says.`, { note: 'Paid appearances now pay double.' }]; }, then: 'queue' },
    { label: 'Hire a quiet, boring agent who answers emails.', do() { S.flags.agent = 'steady'; fx({ coach: 2, conf: 2 }); return [`Her name is Margaret. She wears cardigans. She reads every contract twice and has never been on TV. You love her.`, { s: 'Margaret', t: `I don't do cereal boxes. I do fine print. Call me before you sign anything, including a birthday card.` }, { note: 'Paid appearances are unlocked and pay a little more.' }]; }, then: 'queue' },
    { label: 'Stay on your own for now.', do() { S.flags.agent = null; fx({ conf: 3 }); return [`Sly leaves the metal card on your windshield anyway. You use it as an ice scraper.`]; }, then: 'queue' },
  ],
});

P.w7_return = () => {
  if (S.flags.keep == null) S.flags.keep = keepJob();
  const keep = S.flags.keep;
  return {
    kicker: 'Week 7 · Wednesday',
    title: 'Depth Chart',
    body: [
      `Vane's walking boot comes off on Monday. On Wednesday, Coach Bramble tapes the depth chart to the locker room door, the way he has for twenty-two years.`,
      `Everyone pretends not to look at it. Everyone looks at it.`,
      keep ? `The top line reads {LAST}. The second line reads VANE.` : `The top line reads VANE. Under it, in smaller letters: {LAST} (packages).`,
      keep ? { s: 'Coach Bramble', t: `You earned it. Now keep it.` } : { s: 'Coach Okafor', t: `You played well. He's a two-time Pro Bowler. You'll split snaps, and you'll get your chances. I promise you that.` },
    ],
    choices: keep ? [
      { label: 'Go find Vane and talk to him.', do() { S.role = 'starter'; if (S.rel.vane >= 30) { fx({ vane: 10, chem: 5 }); return [`He's already waiting at your locker.`, { s: 'Marcus Vane', t: `You know the worst part? You're right for the job. I'll help however I can. Don't make me regret saying that.` }]; } fx({ vane: 3 }); return [`He listens to you stumble through it.`, { s: 'Marcus Vane', t: `Good for you, rookie.` }, `He walks away. It's going to be a long few weeks in that locker room.`]; }, then: 'queue' },
      { label: 'Give him space.', do() { S.role = 'starter'; fx({ vane: S.rel.vane >= 30 ? 0 : -4, conf: 2 }); return [`You keep your head down. The locker room is very quiet that week.`]; }, then: 'queue' },
      { label: 'Tell the media it\'s still Marcus\'s team.', do() { S.role = 'starter'; fx({ vane: 8, fame: -2, chem: 3 }); return [`Jules Park looks at you like you've grown a second head. Vane hears about it. That afternoon he moves his locker stool six inches closer to yours.`]; }, then: 'queue' },
    ] : [
      { label: 'Shake Vane\'s hand and congratulate him.', do() { S.role = 'rotation'; fx({ vane: 10, chem: 5, coach: 3 }); return [`He looks surprised. Then he grips your hand.`, { s: 'Marcus Vane', t: `You made this hard on me, rook. That's a compliment.` }]; }, then: 'queue' },
      { label: 'Ask Bramble what you need to do better.', do() { S.role = 'rotation'; fx({ coach: 6, skill: 3 }); return [`Bramble hands you a list. It's typed. It's two pages long. He'd had it ready.`]; }, then: 'queue' },
      { label: 'Sulk.', do() { S.role = 'rotation'; fx({ conf: -5, chem: -4 }); return [`You're short with everyone all week. Tiny gives you the last bowl of cereal without being asked, which somehow makes it worse.`]; }, then: 'queue' },
    ],
  };
};

P.w8_thanks = () => {
  const t = arcs().tiny, truckOK = truckSaved();
  const body = [
    `The Thanksgiving game means a short week and the whole country watching.`,
    `Tiny's family does their Thanksgiving a day early because of the game. Twenty-two cousins, three ovens, and his auntie's famous turkey tails.`,
  ];
  if (t.truck) body.push(truckOK
    ? `Mama Fonoti's is parked in the driveway with its new generator humming. Somebody has strung lights along the serving window. Tiny pats the side of it every time he walks past, like it's a horse.`
    : `Mama Fonoti's sits in the driveway, dark. Tiny parks next to it and doesn't look at it.`);
  body.push({ s: 'Tiny', t: `You're coming. That's not a question. Nana already set you a plate.` });
  const fam = {
    town: { label: 'Fly Grandma Bea in for a hotel-room dinner.', sub: 'Costs $3,000', cost: -3000, text: [`Room service turkey on a hotel bed, with the parade on TV. Grandma Bea inspects the pie, sniffs it, and declares it "fine." From her, that's a rave. She says it's the best Thanksgiving ever. She might be lying, but you don't think so.`] },
    city: { label: 'Bring Thanksgiving to Mom\'s break room at the ER.', sub: 'Costs $800', cost: -800, text: [`Mom works Thanksgiving. She always has. So you show up at the ER break room at 9 p.m. with a turkey, four pies, and enough stuffing for the whole night shift.`, `She gets eleven minutes off. She spends them watching you carve, crying a little, and telling a resident that you're "the football one."`] },
    base: { label: 'Fly Dad in for a hotel-room dinner.', sub: 'Costs $3,000', cost: -3000, text: [`Room service turkey on a hotel bed, with the parade on TV. Dad makes his bed before dinner. Then he makes yours. He says it's the best Thanksgiving in years. He isn't lying. He doesn't know how.`] },
  }[S.origin];
  return {
    kicker: 'Week 8 · Thanksgiving',
    title: 'Three Ovens',
    body,
    choices: [
      { label: 'Go to Tiny\'s family dinner.', do() {
          fx({ chem: 10, conf: 4, energy: -4 });
          const out = [`Nana Fonoti puts a fourth helping on your plate before you finish the third.`,
            { s: 'Nana Fonoti', t: truckOK ? `You. You're the one who helped Losa with the truck. Sit here, by me. Eat.` : `So skinny. You play with my Tavita? Eat. He needs you strong.` },
            `His uncle teaches you a card game, and you lose $40 to a nine-year-old.`];
          out.push(S.flags.karaoke === 'all'
            ? `After dinner, somebody wheels out a karaoke machine. Tiny tells all twenty-two cousins about the Rusty Anchor, and the two of you do the power ballad again. Nana Fonoti sings the high note. It's the best night you've had all season.`
            : `It's the best night you've had all season.`);
          return out;
        }, then: 'queue' },
      { if: () => S.st.money >= -fam.cost, label: fam.label, sub: fam.sub, do() { fx({ money: fam.cost, family: 12, conf: 3 }); return fam.text; }, then: 'queue' },
      { label: 'Skip it. Cold tub, then sleep.', do() { fx({ energy: 18, skill: 1 }); return [`Tiny texts you a photo of your empty chair with a plate on it. Then he texts you a photo of himself eating what was on the plate.`]; }, then: 'queue' },
    ],
  };
};

P.w9_leo = () => ({
  kicker: 'Week 9 · Harbor City Children\'s Hospital',
  title: 'Room 412',
  body: [
    `The team visits the children's hospital every December. In room 412, there's a nine-year-old named Leo wearing your jersey, number {num}. It's three sizes too big. His IV pole has a Hammerheads sticker on it.`,
    { s: 'Leo', t: `You're my favorite player. My mom says you didn't even get drafted. That's so cool. Nobody picks me for kickball either.` },
    S.items.blitz ? { s: 'Leo', t: `Is Blitz real? Is he really your dog? Does he have a jersey? Can he come next time?` } : '',
  ],
  choices: [
    { label: 'Promise Leo a {big} on Sunday, just for him.', do() { S.flags.leoPromise = true; S.flags.leoVisit = true; fx({ conf: 3 }); return [`His eyes go huge. "For real?" You hook pinkies on it. Now you have to deliver.`]; }, then: 'queue' },
    { label: 'Give him your game gloves and stay an extra hour.', do() { S.flags.leoVisit = true; fx({ conf: 4, fame: 3, family: 3 }); return [`You lose eleven straight games of a racing game to Leo. He is ruthless. The nurses take a picture of the two of you that ends up on the hospital's front page.`]; }, then: 'queue' },
    { label: 'Tell him about getting passed over, and how it doesn\'t matter.', do() { S.flags.leoVisit = true; fx({ conf: 5, family: 2 }); return [`You tell him the whole story: the 257 names, the phone call at 11:52, the Turk. When you finish, Leo says, "So you're like a superhero origin story." You guess you are.`]; }, then: 'queue' },
  ],
});

P.w10_stakes = () => {
  const w = S.record.w, v = S.rel.vane, ds = danteState();
  const line = w >= 6 ? `You've already clinched a playoff spot. Bramble doesn't care. "Every game counts. This one counts more because it's the next one."`
    : w === 5 ? `Win, and you're in the playoffs. Lose, and it comes down to tiebreakers.`
    : w === 4 ? `Even a win might not be enough. At 5-5, you'd need the tiebreakers to break your way, and the tiebreakers favor teams that play together.`
    : `The playoffs are out of reach. But it's the Monarchs, and it's your field, and that's enough.`;
  const dante = ds === 'friend' ? `Kingsley texts you on Wednesday: *See you Sunday. Tell Tiny I want a rematch on the cake.*`
    : ds === 'grudge' ? `Kingsley spends a whole podcast episode on you. It's called "Receipts." It's fifty-one minutes long.`
    : `On his podcast, Kingsley says he's "looking forward to it." That's all he says. Somehow that's scarier.`;
  const body = [`The Monarchs rematch, on your field. The stadium has been sold out for a month.`, line, dante,
    `Saturday night, the team meets at the hotel. Bramble asks if anyone wants to say something.`];
  if (v >= 40) body.push(`Vane catches your eye from across the room, then stands up first.`,
    { s: 'Marcus Vane', t: S.flags.keep ? `Twelve years. This is probably my last home game in this building. I'm not sad about it. I got to watch somebody take my job the right way.` : `Twelve years. This is probably my last home game in this building. I'm not sad about it. I got to spend it next to a kid who came after my job the right way, every single day. He's not done. I can tell.` },
    `He sits down and looks straight at you. ${S.flags.locker === 'poster' ? 'You think about the poster. The frosted tips are gray now. ' : ''}It's your turn.`);
  else if (v >= 0) body.push(`Vane sits in the back row, the way he has all season. When he catches you looking, he nods once.`);
  else body.push(`Vane sits as far from you as the room allows. On the way in, you heard him tell a reporter, "Some guys play ten good games and think they've arrived."`);
  return {
    kicker: 'Week 10 · Season finale',
    title: 'Last Regular-Season Game',
    body,
    choices: [
      { label: v >= 40 ? 'Stand up after Vane and speak to the team.' : 'Stand up and speak to the team.', do() {
          arcs().vane = 'speech';
          if (v >= 40) { fx({ chem: 10, conf: 4, vane: 6 }); return [`${S.flags.locker === 'poster' ? 'You talk about the poster on your wall, and the man who wouldn\'t look at the tape on your locker.' : 'You talk about Day 1, and the man in the next locker who wouldn\'t look at the tape with your name on it.'} You talk about draft night, and how this room is the first place you've ever felt picked.`, `When you sit down, Vane reaches over and grips the back of your neck, once, the way coaches do. Tiny is openly weeping.`, arcNote('Vane')]; }
          if (S.st.conf >= 60) { fx({ chem: 8, conf: 3 }); return [`You talk about draft night. About the phone not ringing. About how this room is the first place you've ever felt picked. When you sit down, nobody says anything for a long moment. Then Tiny starts clapping, and everybody joins in.`]; }
          fx({ chem: 4 }); return [`Your voice shakes and you lose your place twice. But you mean every word, and they can tell. Vane nods at you on the way out.`];
        }, then: 'queue' },
      { label: 'Let the captains talk. You listen.', do() { arcs().vane = 'listen'; fx({ coach: 3, conf: 2, vane: 3 }); return [v >= 40 ? `You let Vane's words be the last ones. Some speeches don't need a second act. On the way out, he squeezes your shoulder.` : `Vane speaks last. He talks about how many of these games he has left. Not many. The room gets very quiet.`]; }, then: 'queue' },
      { if: () => v < 20, label: 'Find Vane after the meeting.', do() {
          arcs().vane = 'talk';
          if (v < 0) { fx({ vane: 14, conf: 2 }); return [`He's at the ice machine. He doesn't turn around.`, { s: 'Marcus Vane', t: `You here to gloat?` }, `You tell him you're there because you had his poster on your wall, and because you don't want to finish the season without saying so. He fills his bucket. He takes a long time doing it.`, { s: 'Marcus Vane', t: `I've been the kid. I've been the guy the kid replaced. Nobody tells you the second one is harder.` }, `He doesn't apologize. Neither do you. But he holds the elevator.`, arcNote('Vane')]; }
          fx({ vane: 10, chem: 2 }); return [`You find him in the hotel lobby, watching a hockey game he doesn't care about. You sit down next to him. For twenty minutes, neither of you says a word about football.`, { s: 'Marcus Vane', t: `You're all right, rook. Don't tell anybody I said that.` }, arcNote('Vane')];
        }, then: 'queue' },
      { label: 'Headphones on. Lock in.', do() { arcs().vane = 'focus'; S.flags.focus = true; fx({ conf: 2 }); return [`You run through every play in your head twice.`, { note: 'Locked in: you\'ll have film notes on your reads this week.' }]; }, then: 'queue' },
    ],
  };
};

P.po_gate = () => {
  const w = S.record.w, l = S.record.l;
  if (S.flags.inPO == null) S.flags.inPO = w >= 6 || (w === 5 && S.st.chem >= 55);
  const inPO = S.flags.inPO;
  if (inPO) award('playoffs');
  const ok = arcs().ok;
  return {
    kicker: 'End of the regular season',
    title: inPO ? 'Playoff Bound' : 'On the Outside',
    body: inPO ? [
      `Final record: **${w}-${l}**.`,
      w === 5 ? `It comes down to tiebreakers, and the tiebreaker is a formula nobody understands. The short version: your team played together. You're in.` : `The Hammerheads are in the playoffs. Three wins from a championship.`,
      `Tiny runs through the locker room spraying a bottle of sparkling cider. Bramble lets it happen, which is how you know it's real.`,
      okLeaving() ? `Okafor stands in the doorway of her office and watches it all. You realize she's memorizing it.` : '',
    ] : [
      `Final record: **${w}-${l}**.`,
      `It isn't enough. The playoff picture is set, and the Hammerheads aren't in it.`,
      `The locker room is quiet. Somebody starts packing.`,
    ],
    choices: [inPO ? { label: 'On to the playoffs', primary: true, then: 'beginWeek' } : { label: 'See how your season ends', primary: true, then: 'ending' }],
  };
};

P.po1 = () => {
  const leaving = okLeaving();
  const leo = S.flags.leoKept ? `A nurse from room 412 sends you a video. Leo, in your jersey, has drawn a playoff bracket on his whiteboard. The Hammerheads win every round. Some rounds twice.`
    : S.flags.leoPromise ? `Leo sends a text through his mom: *Playoffs = the next one, right?* Right.`
    : S.flags.leoVisit ? `Leo's mom sends a photo: room 412, with a Hammerheads flag taped over the window.` : '';
  const callFam = {
    town: `"I'm not missing a playoff game," Grandma Bea says. "The Bluebird can make its own pancakes for one Sunday. It won't. But it can."`,
    city: `"I already traded three shifts," Mom says. "I'm not missing a playoff game. I don't care who I owe."`,
    base: `"I'm not missing a playoff game," Dad says. "I'll be early." Of course he will.`,
  }[S.origin];
  const steak = S.flags.dinner === 'paid' ? ` The veteran who ordered the $400 steak at the rookie dinner brings two of the pizzas and says this makes you even. It does not.` : S.flags.dinner === 'refused' ? ` Somebody brings a roll of athletic tape as a housewarming gift. Everybody laughs except you.` : '';
  return {
    kicker: 'Playoffs · Wild Card week',
    title: 'Win or Go Home',
    body: [
      `Playoff week feels different. Practice is quieter. The music in the weight room is turned down. Even Tiny is only eating one bowl of cereal at a time.`,
      `Lose on Sunday and the season is over. Everybody knows it, and nobody says it.`,
      leo,
    ],
    choices: [
      { label: 'Host a team film night at your place.', do() { fx({ chem: 6, skill: 2 }); return [`Twenty guys squeeze into your apartment, which still has no furniture. They sit on the floor, eat four pizzas, and watch every Grizzlies snap from the last month.${steak}`]; }, then: 'queue' },
      { label: leaving ? 'Extra session with Okafor, while you still can.' : 'Extra session with Okafor.', do() { fx({ skill: 4, coach: 4, energy: -8 }); return [leaving ? `She brings a whiteboard to the practice field. You go until the security guard flickers the stadium lights. Neither of you mentions that this might be the last time she does this here. She draws every route twice as carefully.` : `She brings a whiteboard to the practice field. You go until the security guard flickers the stadium lights.`]; }, then: 'queue' },
      { label: 'Call {fam}.', do() { fx({ conf: 6, family: 4 }); return [callFam]; }, then: 'queue' },
    ],
  };
};

P.po2 = () => {
  const ds = danteState(), t = S.flags.trash;
  let intro, text;
  if (ds === 'friend') {
    intro = `Tuesday night, a text from Kingsley. You've been texting since Week 5, mostly about cake, which neither of you has told your teams.`;
    text = `Third time. Not gonna lie to you, I want this one bad. But if it's not us, I hope it's you. Delete this.`;
  } else if (ds === 'grudge') {
    intro = `Tuesday night, Kingsley posts your worst play of the season, slowed down, with a crown emoji. Then he texts you from a number you don't have saved.`;
    text = `Third time. Last time. Pack for a long offseason, rook.`;
  } else {
    intro = `Tuesday night, a text from a number you don't know.`;
    text = t === 'fire' ? `Third time. No podcast this week. You earned that. See you Sunday.` : t === 'cake' ? `Third time. Still thinking about that cake. Respect. See you Sunday.` : `Third time. You don't talk much. I respect that. See you Sunday.`;
  }
  return {
    kicker: 'Playoffs · Conference Championship week',
    title: 'Third Time',
    body: [
      `The winner of Sunday's game goes to the Championship. The Monarchs, again.`,
      intro,
      { s: 'Dante Kingsley', t: text },
    ],
    choices: [
      { label: ds === 'grudge' ? 'Reply: "See you Sunday."' : 'Reply: "Respect. See you Sunday."', do() { danteAdd(1, 0); fx({ conf: 4 }); return [ds === 'grudge' ? `Three dots appear. Then disappear. Then nothing. You've gotten under his crown.` : `He reacts with a crown emoji. You'll take it.`]; }, then: 'queue' },
      t === 'cake' ? { label: 'Send him a photo of another crown cake.', do() { danteAdd(ds === 'grudge' ? 0 : 1, ds === 'grudge' ? 1 : 0); fx({ fame: 4, chem: 3 }); return [ds === 'grudge' ? `He doesn't reply. He posts it, though, with the caption "they think this is funny." Half the internet thinks it's funny. Tiny eats this cake too.` : `"LMAOOO." He posts it. Half the internet sees it. Tiny eats this cake too.`]; }, then: 'queue' }
        : t === 'fire' ? { label: 'Send him a photo of a receipt.', do() { danteAdd(0, 1); fx({ fame: 5, conf: 2, coach: -1 }); return [ds === 'grudge' ? `He screenshots it and posts it with one word: "Sunday." It's on every sports show by breakfast. Bramble makes you run a lap for every show.` : `"Keep it," he writes back. "You'll need it Sunday." It's the friendliest threat you've ever received.`]; }, then: 'queue' }
        : { label: 'Send him a photo of his clip, still pinned inside your locker.', do() { danteAdd(1, 0); fx({ conf: 3, coach: 1 }); return [`A minute later he sends a photo back: the inside of his own locker. Taped to it is the Ledger's headline from the week you first played. Neither of you types anything else.`]; }, then: 'queue' },
      { label: 'Leave him on read.', do() { danteAdd(0, ds === 'friend' ? 0 : 1); S.flags.focus = true; fx({ conf: 2, coach: 2 }); return [`You put the phone in your locker and leave it there until Sunday.`, { note: 'Locked in: you\'ll have film notes on your reads this week.' }]; }, then: 'queue' },
    ],
  };
};

P.po3_media = () => ({
  kicker: 'The Championship · Media day',
  title: 'Media Day',
  body: [
    `Championship media day: four thousand reporters, a stadium full of cameras, and a man dressed as a hammerhead shark holding a microphone.`,
    { s: 'Shark Man', t: `{first}! If you were a sandwich, what kind of sandwich would you be?` },
  ],
  choices: [
    { label: '"Turkey on wheat. Reliable."', do() { S.flags.sandwich = 'turkey'; fx({ coach: 3, conf: 2 }); return [`Bramble watches the clip that night and almost, almost laughs.`]; }, then: 'po3_night' },
    { label: '"A triple-decker with everything on it. Extra pickles."', do() { S.flags.sandwich = 'triple'; fx({ fame: 8 }); return [`The clip goes viral. A sandwich shop in Harbor City names a sandwich after you by Thursday. It's enormous.`]; }, then: 'po3_night' },
    { label: 'Ignore the question and shout out {fam} and {home}.', do() { S.flags.sandwich = 'shout'; fx({ family: 10, fame: 4 }); return [`Back home, people scream at their TVs. {fam} watches it on repeat.`]; }, then: 'po3_night' },
  ],
});

P.po3_night = () => {
  const vane = S.rel.vane >= 40;
  if (S.flags.night == null) {
    S.flags.night = true;
    if (vane) { S.items.band = true; if (S.role === 'rotation') { S.role = 'starter'; S.flags.vaneStart = true; } }
    save();
  }
  const tiny = arcs().tiny;
  return {
    kicker: 'The Championship · The night before',
    title: 'Knock Knock',
    body: vane ? [
      `11:40 p.m. You're staring at the hotel ceiling when someone knocks. It's Vane, holding something.`,
      { s: 'Marcus Vane', t: `I wore this wristband in my first playoff game. Lost. Wore it in three more, years ago. Lost every one. I left it in my bag the last two weeks, and look what happened. Maybe it was waiting for somebody new.` },
      `He tosses it to you.`,
      S.flags.vaneStart ? { s: 'Marcus Vane', t: `And I told Bramble to start you tomorrow. He agreed. Don't look at your feet.` } : { s: 'Marcus Vane', t: `Don't look at your feet.` },
      { note: S.flags.vaneStart ? 'New item: Vane\'s wristband. You\'re starting the Championship.' : 'New item: Vane\'s wristband. Bigger window on clutch plays.' },
    ] : [
      `11:40 p.m. You're staring at the hotel ceiling when someone knocks. It's Tiny, holding two bowls of cereal.`,
      { s: 'Tiny', t: `Couldn't sleep either.` },
      `You eat cereal on the floor and talk about nothing until one in the morning.${S.flags.karaoke === 'all' ? ' At some point he starts humming the power ballad from the Rusty Anchor, and you sing backup, quietly, so you don\'t wake up the hallway.' : ''}${tiny.fate === 'market' || tiny.fate === 'sly' ? ' Neither of you mentions that this might be his last game as a Hammerhead.' : ''} It helps more than you'd think.`,
    ],
    choices: [
      { label: 'Call {fam} before bed.', do() { fx({ family: 6, conf: 6, chem: vane ? 0 : 3 }); return [{ s: '{fam}', t: `Whatever happens tomorrow, you already did the impossible thing. Now go have fun.` }]; }, then: 'queue' },
      { label: 'Watch film until 2 a.m.', do() { S.flags.focus = true; fx({ skill: 3, energy: -10, chem: vane ? 0 : 3 }); return [`You know their tendencies better than they do.`, { note: 'Locked in: you\'ll have film notes on your reads this week.' }]; }, then: 'queue' },
      { label: 'Sleep. Actually sleep.', do() { fx({ energy: 20, chem: vane ? 0 : 3 }); return [S.items.blitz ? `Eight hours. Blitz sleeps across your feet the whole night, snoring like a leaf blower. You don't dream about anything.` : `Eight hours. You don't dream about anything.`]; }, then: 'queue' },
    ],
  };
};

// ---------- Endings ----------
// Okafor's arc changes who says what in a few endings (see 42-arcs.js).
const ENDINGS = {
  legend: { title: 'A Legend Is Born', body: () => [
    `The confetti is orange and white, and it gets everywhere. In your helmet. In your mouth. In Tiny's beard, where it will stay until March.`,
    `They hand you the Championship MVP trophy. It's heavier than it looks. A man in a blazer holds a microphone in front of your face and asks how it feels.`,
    `Two hundred and fifty-seven players were drafted ahead of you. You think about every single one of them for exactly one second. Then you let it go.`,
    S.flags.draftNight === 'receipts' ? `On the bus to the parade, you open the folder on your phone called RECEIPTS. Nineteen screenshots. You delete them one at a time, and you don't read a single one.` : '',
    { s: 'You', t: `I just want to say hi to {fam}.` },
  ] },
  ring: { title: 'Ring Bearer', body: () => [
    `You didn't win MVP. You don't care at all. You're a champion.`,
    `In the locker room afterward, Bramble finds you. He has never said "good job" to anyone, and he doesn't now either. He puts a hand on your shoulder pad and leaves it there for a second.`,
    `That's better than "good job."`,
    `Two days later, the parade route runs eleven miles through Harbor City. People stand on mailboxes. A man dressed as a hammerhead shark cries the entire way.${S.flags.sandwich === 'triple' ? ' He is eating your sandwich.' : ''}`,
    okLeaving() ? `Okafor rides on the float behind yours. It's her last day as a Hammerhead. She spends all eleven miles waving with both hands, which nobody has ever seen her do.` : '',
  ] },
  close: { title: 'Confetti for Somebody Else', body: () => [
    `The confetti falls, and it's the wrong colors.`,
    `You sit on the bench with your helmet on for a long time. Tiny sits next to you and doesn't say anything, which is the nicest thing he could do.`,
    `On the flight home, Okafor drops into the seat next to you with her laptop already open.`,
    okLeaving()
      ? { s: 'Coach Okafor', t: `This is my last flight with this team, so listen. You were one game away, {last}. One. Go find it. I'll be watching from Ridgeline, and I will know if you skip film.` }
      : { s: 'Coach Okafor', t: `The offseason starts now. You were one game away, {last}. One. Let's go find it.` },
  ] },
  climb: { title: 'The Climb', body: () => [
    `Playoff football ends fast. One day you're preparing for the next round. The next morning you're cleaning out your locker into a trash bag.`,
    `But you got here. Undrafted rookies don't usually make the playoffs. They basically never do.`,
    { s: 'Coach Bramble', t: `Report date is March 30th. Don't be late. And {last}? Don't be average, either.` },
    `You replay it the whole drive home. It might be a compliment. With Bramble, that's the ceiling.`,
  ] },
  hype: { title: 'All Hype', body: () => [
    `You have two million followers, ${S.flags.zapp && S.flags.zapp !== 'no' ? 'a ZAPP! Hydration commercial' : 'a sneaker ad'}, and a hoodie line. You do not have a playoff game.`,
    `In the final team meeting, guys don't quite look at you. Tiny still does. Tiny always does.`,
    { s: 'Tiny', t: `You're good, bro. Real good. But the guys need to know you're one of us. Get off your phone a little, yeah?` },
    `You put it face-down on the table. It buzzes. You leave it there.`,
  ] },
  heart: { title: 'Heart of the Team', body: () => [
    `You missed the playoffs. It stings like nothing has stung before.`,
    `But on the last day, the team votes on its own rookie award, and you win it in a landslide. Tiny voted for you twice. That's not allowed. Nobody stops him.`,
    `Bramble hands you the plaque. It's crooked, because Rocco made it in his garage.`,
    `It's the best thing you own.`,
  ] },
  next: { title: 'Next Year', body: () => [
    `The season ends before the playoffs start. You clean out your locker into a trash bag, the way everyone does.`,
    `But you're still here. The undrafted kid from {home} made a roster and finished the season on it. Most camp bodies never get that far.`,
    okLeaving()
      ? { s: 'Coach Okafor', t: `You know the difference between you and the guys who got drafted? Nothing anymore. I won't be here in March. You will. That's the whole point.` }
      : { s: 'Coach Okafor', t: `You know the difference between you and the guys who got drafted? Nothing anymore. See you in March.` },
  ] },
};
// The family line in the epilogue. Getters, so the text follows how your family's story played out.
const FAMILY_RICH = {
  get town() { return famCoda(true); },
  get city() { return famCoda(true); },
  get base() { return famCoda(true); },
};
const FAMILY_MODEST = {
  get town() { return famCoda(false); },
  get city() { return famCoda(false); },
  get base() { return famCoda(false); },
};
