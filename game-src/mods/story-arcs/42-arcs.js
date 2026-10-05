
// =========================================================
//   CHARACTER ARCS (year 1)
//   Coach Okafor's job offer, Tiny's contract year, the Dante Kingsley rivalry,
//   a family story per origin, and one more Vane beat (inside P.w10_stakes).
//   Pages live here; 58-arcs-wire.js slots them into weeks (BEATS), chains the
//   postgame ones after specific games, and adds endings rules and codas.
//   State: S.ext.arcs (always read it through arcs()).
// =========================================================
function arcs() {
  const a = ext('arcs', () => ({}));
  if (!a.ok) a.ok = { lean: 0, rumor: null, ref: null, offer: null, leaves: null, why: null };
  if (!a.tiny) a.tiny = { knee: null, truck: null, deal: null, fate: null, hurt: false };
  if (!a.dante) a.dante = { resp: 0, heat: 0, g4: null, g9: null, g11: null, post1: null, post3: null };
  if (!a.fam) a.fam = { a: null, b: null };
  if (!('vane' in a)) a.vane = null;
  return a;
}
// "Tiny will remember that." Styled as a callout by the page hook in 58-arcs-wire.js.
function arcNote(who) { return { note: `${who} will remember that.` }; }
const isY1 = () => !!S && (S.year || 1) === 1;
// Okafor took the Ridgeline job at the end of year one (later seasons handle her absence themselves).
const okLeaving = () => isY1() && arcs().ok.leaves === true;
// Where a postgame arc page goes when it's done (the page the final-score screen would have gone to).
function arcAfter(a) { return a && a.next != null ? a.next : (S.game && S.game.press ? 'g_press' : 'weekEnd'); }
function postKicker() { const g = S.game; return g ? `Postgame · vs ${oppOf(g.n).team}` : 'Postgame'; }

// ---------- Dante Kingsley: respect vs. heat ----------
function danteAdd(r, h) { const d = arcs().dante; d.resp += r || 0; d.heat += h || 0; }
function danteState() {
  const d = arcs().dante;
  // The postgame podium counts too: taunting him on camera, or giving him his due.
  const resp = d.resp + (S.flags.kingsleyCredit ? 1 : 0), heat = d.heat + (S.flags.kingsleyMsg ? 1 : 0);
  if (resp >= 4 && heat <= 1) return 'friend';
  if (heat >= 3 && heat > resp) return 'grudge';
  return 'respect';
}
function danteRecord() {
  const d = arcs().dante, gs = [d.g4, d.g9, d.g11].filter(x => x != null);
  return [gs.filter(Boolean).length, gs.filter(x => !x).length];
}

// ---------- Tiny ----------
function kneeTreated() { const k = arcs().tiny.knee; return k === 'shaw' || k === 'nudge'; }
function truckSaved() { const t = arcs().tiny.truck; return t === 'money' || t === 'time' || t === 'margaret' || t === 'sly'; }

// ---------- Family ----------
function dinerSaved() {
  const f = arcs().fam;
  if (f.a === 'money' || f.a === 'team' || f.a === 'honest') return true;
  if (f.a === 'none') return f.b === 'tape';
  return true;
}

// =========================================================
//   TINY: contract year, a bad knee, his mom's food truck
// =========================================================
P.tiny_knee = () => ({
  kicker: `${weekKicker()} · Training room`,
  title: 'Ice Pack',
  body: [
    `You get to the facility early on Wednesday, before the hallway lights have all come on. The training room door is cracked open.`,
    `Tiny is sitting on a table in the dark with two bags of ice taped around his left knee. When he sees you, he tries to stand up like nothing's wrong. The knee says otherwise.`,
    { s: 'Tiny', t: `It's nothing. Little swelling. Bro, listen. It's my contract year. I'm thirty-one. If the front office hears "Tiny" and "knee" in the same sentence, they start looking at younger guys. Don't say anything. Please.` },
    `He's never said please to you before. He's never had to.`,
  ],
  choices: [
    { label: 'Keep his secret.', do() { arcs().tiny.knee = 'secret'; fx({ chem: 5 }); return [`"You're a real one," he says, and peels off the ice. Every morning that week, you're the one who gets there early to stand by the door.`, arcNote('Tiny')]; }, then: 'queue' },
    { label: 'Tell Dr. Shaw. Today.', do() {
        arcs().tiny.knee = 'shaw'; fx({ chem: -6, coach: 3 });
        return [`Dr. Imani Shaw has him in the MRI tube by lunch.`,
          { s: 'Dr. Imani Shaw', t: `Irritated tendon. Two more weeks of taping it and pretending, and we'd be talking about surgery. Brace, treatment, he plays Sunday. Whoever sent him in did him a favor.` },
          `Tiny doesn't speak to you for two days. On the third day, a bowl of cereal appears at your locker without a word, which is how you know you're forgiven.`, arcNote('Tiny')];
      }, then: 'queue' },
    { label: 'Tell him he has to go to Dr. Shaw himself, or you will.', do() {
        const t = arcs().tiny;
        if (S.st.chem >= 40) { t.knee = 'nudge'; fx({ chem: 2, coach: 2 }); return [`He glares at you. Then he sighs so hard the ice bags shift.`, { s: 'Tiny', t: `Fine. FINE. But you're walking me there.` }, `You do. Dr. Imani Shaw tapes him up, puts him on a treatment plan, and tells the front office it's "routine maintenance." Tiny calls you "Mom" for the rest of the week.`, arcNote('Tiny')]; }
        t.knee = 'stall'; fx({ chem: 1 }); return [{ s: 'Tiny', t: `Yeah, yeah. I'll tell her.` }, `He doesn't. You're not close enough yet for him to listen to you about this. You both know it.`, arcNote('Tiny')];
      }, then: 'queue' },
  ],
});

P.tiny_truck = () => {
  const t = arcs().tiny, f = S.flags.fender, ag = S.flags.agent;
  const body = [
    `Tiny has been yawning at practice all week. Tiny never yawns. Tiny is a morning person in a way that is frankly upsetting.`,
    `On Thursday you find out why. ${f === 'confess' || f === 'note' || f === 'caught' ? 'His pickup, still wearing the dent you gave it,' : 'His pickup'} has a delivery-app sticker on the windshield. He's been driving food deliveries until two in the morning.`,
    { s: 'Tiny', t: `It's my mom's food truck. Mama Fonoti's. Her name's Losa, but the whole waterfront calls her Mama. The city gave her spot on Pier Street to some stadium vendor, and the generator blew the same week. Fifteen grand to get her rolling again somewhere new. She won't take my money because it's my contract year and I'm supposed to be saving. So I'm making it the other way.` },
  ];
  if (S.flags.zapp === 'no') body.push({ s: 'Tiny', t: `I put the ZAPP money into a second grill for her. So now she's got two grills and no truck. That's a joke. That's a joke my life is telling.` });
  if (t.knee === 'secret' || t.knee === 'stall') body.push(`He rubs his left knee when he thinks you aren't looking. Six hours a night behind a steering wheel isn't helping it.`);
  return {
    kicker: `${weekKicker()} · Players' lot`,
    title: 'Mama Fonoti\'s',
    body,
    choices: [
      { if: () => S.st.money >= 15000, label: 'Pay for the generator. Don\'t let him argue.', sub: 'Costs $15,000', do() {
          t.truck = 'money'; award('truck'); fx({ money: -15000, chem: 6 });
          return [`He argues anyway. You win, because you've already called his mom.`, `Losa Fonoti cries on the phone, then makes you promise to eat at the truck for free for the rest of your life. A week later there's a new item on the menu board: THE {LAST}. FOUR MEATS. NO VEGETABLES.`, arcNote('Tiny')];
        }, then: 'queue' },
      { label: 'Work the truck with Tiny on your day off.', sub: S.st.fame >= 30 ? 'Your name might draw a crowd' : 'Takes your day off', do() {
          fx({ energy: -12, chem: 8, fame: 3 });
          if (S.st.fame >= 30) { t.truck = 'time'; award('truck'); return [`Saturday, in an apron, at the farmers market. Somebody recognizes you around eleven. By noon the line wraps around the block. By two, Mama Fonoti's has sold out of everything, including, somehow, the napkins.`, `Losa Fonoti hugs you so hard your back cracks. The generator money is in the cash box by sundown, and Tiny deletes the delivery app in front of you, ceremonially.`, arcNote('Tiny')]; }
          t.truck = 'slow'; return [`Saturday, in an apron, at the farmers market. Nobody recognizes you. You sell sixty-one plates and burn your forearm on the grill.`, `It isn't fifteen grand. It's a start. And Tiny stops driving deliveries after midnight, because now he has a business partner who needs him rested.`, arcNote('Tiny')];
        }, then: 'queue' },
      { if: () => ag === 'steady', label: 'Call Margaret.', do() {
          t.truck = 'margaret'; award('truck'); fx({ chem: 6, coach: 1 });
          return [`Margaret listens to the whole story without interrupting. Then she asks eleven questions, all of them boring and all of them important.`, { s: 'Margaret', t: `There's a small-business grant for food vendors displaced by stadium contracts. Nobody applies because the form is nineteen pages. I love a nineteen-page form.` }, `The check clears in ten days. Losa Fonoti sends Margaret a cardigan.`, arcNote('Tiny')];
        }, then: 'queue' },
      { if: () => ag === 'sly', label: 'Call Sly.', do() {
          t.truck = 'sly'; award('truck'); fx({ chem: 3, fame: 4 });
          return [{ s: 'Sly Pemberton', t: `A food truck? Kid. Say no more. I know a guy who knows a sponsor who knows a guy.` }, `By Monday the truck has a new generator and a forty-foot vinyl wrap of Sly's face: SLY PEMBERTON SPORTS MANAGEMENT. WE DELIVER.`, `Tiny's mom hates it. The truck has never been busier.`, arcNote('Tiny')];
        }, then: 'queue' },
      { label: 'Stay out of it. It\'s his family\'s business.', do() {
          t.truck = 'out'; fx({ chem: -2, energy: 3 });
          return [`You tell him you hope it works out. He says thanks, and means it, and goes back to yawning.`, `Every night that week, his truck starts up in the players' lot at eleven.`];
        }, then: 'queue' },
    ],
  };
};

// Thanksgiving night, after the game.
P.tiny_deal = a => {
  const t = arcs().tiny, treated = kneeTreated();
  const hurt = !treated && t.knee != null && !truckSaved() && t.truck !== 'slow';
  if (t.knee != null && !treated) t.hurt = hurt;
  const tier = treated ? 'three' : hurt ? 'one' : 'two';
  const up = { one: 'two', two: 'three', three: 'three' };
  const knee = treated ? `His knee held up all game. The brace he named Nana did its job, and he wants that on the record.`
    : hurt ? `In the third quarter today, his knee buckled on a double-team. He finished the drive anyway. He limped all the way to the truck.`
    : t.knee ? `His knee is wrapped like a mummy. It held. Barely.` : `He's icing his left knee. "Out of habit," he says.`;
  const offer = { three: `They want to extend me. Three years. Real money. Dr. Shaw's report says "maintenance," so nobody's scared.`, two: `Two years. Not great, not bad. They know something's up with the knee. They don't know how much.`, one: `One year. A prove-it deal. They saw the knee today. Everybody saw the knee today.` }[tier];
  const next = arcAfter(a);
  const fateText = {
    three: `He signs it on the tailgate with a pen from your glove box. Then he calls his mom, and you walk away to give him a minute, and you can still hear her screaming from forty feet.`,
    two: `He signs it on the tailgate. "Two's plenty," he says. "Two's a whole lot of cereal."`,
    one: `He signs it on the tailgate. "One year," he says. "One year to show them." He's already rubbing the knee.`,
  };
  return {
    kicker: postKicker(),
    title: 'Contract Year',
    body: [
      `Thanksgiving night. The stadium lights are off, the turkey is gone, and Tiny is sitting on the tailgate of his pickup in the players' lot with a folder in his lap.`,
      knee,
      { s: 'Tiny', t: offer },
      { s: 'Tiny', t: `My mom says sign it. My agent says wait for free agency. You're the only one who doesn't want something. What would you do?` },
    ],
    choices: [
      { label: '"Sign it. Harbor City is home."', do() { t.deal = 'sign'; t.fate = tier; fx({ chem: 4 }); return [fateText[tier], arcNote('Tiny')]; }, then: next },
      { label: '"Bet on yourself. Test the market."', do() {
          t.deal = 'market'; t.fate = treated ? 'market' : 'gamble'; fx({ chem: 2, conf: 1 });
          return [treated ? `He looks at the folder for a long time. "Yeah," he says finally. "Yeah. I'm good. I'm actually good." He closes it. He doesn't sign. It's the first time all year he's sounded scared and happy at the same time.` : `He looks down at the knee. "Bet on myself," he repeats. He doesn't sign. You both know the knee is going to have something to say about it.`, arcNote('Tiny')];
        }, then: next },
      { if: () => S.flags.agent === 'steady', label: '"Let Margaret read it first."', do() {
          t.deal = 'margaret'; t.fate = up[tier]; fx({ chem: 4 });
          return [`Margaret reads it in the players' lot by the light of your phone. She finds two problems on page six and one opportunity on page nine.`, { s: 'Margaret', t: tier === 'three' ? `Tell them he'll sign today if they guarantee all three years. They will. They're terrified of losing him, and they don't know that we know.` : `Tell them he'll sign today for one more year, guaranteed. They'll say yes. They're terrified of losing him, and they don't know that we know.` }, `They do. ${fateText[up[tier]]}`, arcNote('Tiny')];
        }, then: next },
      { if: () => S.flags.agent === 'sly', label: '"Let Sly take a look."', do() {
          t.deal = 'sly'; t.fate = 'sly'; fx({ chem: -2, fame: 2 });
          return [`Sly picks up on the first ring, on Thanksgiving, from what sounds like a yacht.`, { s: 'Sly Pemberton', t: `${{ three: 'Three years', two: 'Two years', one: 'One year' }[tier]}? For the best center in the conference? Kid, put him on the phone. I'm about to change that man's life.` }, `Tiny talks to Sly for forty minutes. When he hangs up, he looks like he's been hit by a very friendly truck.`, arcNote('Tiny')];
        }, then: next },
      { if: () => S.st.chem >= 60 || S.rel.coach >= 60, label: 'Go tell the front office what he means to this team.', do() {
          t.deal = 'gm'; t.fate = up[tier]; fx({ coach: 2, chem: 5 });
          return [`You catch the general manager before he leaves the stadium. His office has a fish tank. You talk for six minutes about Tiny: the cereal, the grill, the three helmet bangs before every game, the way the locker room sounds different when he's in it.`, `The GM listens to all six minutes without interrupting. By the time you get back to the lot, Tiny's phone is buzzing. The offer has a new number on it.`, fateText[up[tier]], arcNote('Tiny')];
        }, then: next },
    ],
  };
};

// =========================================================
//   COACH OKAFOR: the Ridgeline State job
// =========================================================
P.ok_suit = () => ({
  kicker: `${weekKicker()} · Monday`,
  title: 'The Suit',
  body: [
    `Monday morning, Coach Okafor walks through the facility in a suit. Nobody has ever seen her in a suit. Tiny asks if somebody died.`,
    `At lunch, Jules Park from the Harbor City Ledger catches you by the vending machines.`,
    { s: 'Jules Park', t: `Off the record, for now. Ridgeline State interviewed Nina Okafor for their head coaching job on Saturday. She'd be the first woman to run a major college program. If they offer, do you think she takes it?` },
  ],
  choices: [
    { label: '"She\'d be great at it. Ridgeline would be lucky."', do() {
        const o = arcs().ok; o.rumor = 'support'; o.lean += 1; fx({ coach: 3, fame: 1 });
        return [`Jules writes it down word for word. That night, Okafor passes you in the hallway, still in the suit.`, { s: 'Coach Okafor', t: `Read the Ledger this afternoon. You're not supposed to talk to reporters about my business.` }, `A pause.`, { s: 'Coach Okafor', t: `Thank you.` }, arcNote('Okafor')];
      }, then: 'queue' },
    { label: '"She\'s not going anywhere. She\'s got work to do here."', do() {
        const o = arcs().ok; o.rumor = 'keep'; o.lean -= 1; fx({ coach: 2, conf: 2 });
        return [`It runs as the headline: ROOKIE ON OKAFOR: "NOT GOING ANYWHERE."`, `Okafor tapes it to her office door. Underneath, in red marker, she writes: *We'll see.* You can't tell if she's annoyed or flattered. Maybe she can't either.`, arcNote('Okafor')];
      }, then: 'queue' },
    { label: '"You\'d have to ask her."', do() {
        arcs().ok.rumor = 'out'; fx({ coach: 1 });
        return [`Jules sighs. "Everybody says that." Nobody ever tells Jules anything good by the vending machines.`, `At practice, Okafor is sharper than usual. She runs your group through the same drill eleven times. On the twelfth, she finally smiles.`];
      }, then: 'queue' },
    { label: 'Skip lunch and go ask Okafor yourself.', do() {
        arcs().ok.rumor = 'ask'; fx({ coach: 3, skill: 2, energy: -3 });
        return [`Her office door is open. She doesn't look up.`, { s: 'Coach Okafor', t: `Yes, I interviewed. No, I don't know. And no, it doesn't change a single thing about this week.` }, `She hands you a stack of film cut-ups without looking up.`, { s: 'Coach Okafor', t: `Watch all of these. If I ever leave, I want to leave something that works.` }, arcNote('Okafor')];
      }, then: 'queue' },
  ],
});

// The rave answer only calls back to things this player actually saw: the draft-night call always,
// her 4:30 a.m. start if she told you or you met her at dawn, the forty-one pauses if that film session came up.
function okRefLabel() {
  const bits = ['the 11:52 phone call'];
  if (S.flags.callAns === 'yes' || S.flags.fiveam === 'early') bits.push('the 4:30 alarm');
  if (S.flags.film41) bits.push('the forty-one pauses');
  const list = bits.join(', ');
  return `Tell him everything. ${list[0].toUpperCase() + list.slice(1)}, all of it.`;
}
P.ok_ref = () => ({
  kicker: `${weekKicker()} · Wednesday`,
  title: 'Reference Check',
  body: [
    `${S.slate === 4 ? 'Wednesday of Monarchs week' : 'Wednesday'}, your phone buzzes. Unknown number. You almost don't answer. Then you remember the last time an unknown number called you.`,
    `It's the athletic director at Ridgeline State. Coach Okafor listed three references: a retired head coach, a college president, and you.`,
    `"She said you'd know what she's like on a Tuesday," the AD says. "Anybody can tell me what a coach is like on a Sunday."`,
  ],
  choices: [
    { label: okRefLabel(), do() {
        const o = arcs().ok; o.ref = 'rave'; o.lean += 1; fx({ coach: 4 });
        const extra = S.flags.fiveam === 'early' ? ` You tell him about the morning you showed up at 4:45, and she'd already been there for fifteen minutes.` : S.flags.made === false ? ` You tell him she went to bat for a practice-squad kid nobody else wanted.` : '';
        return [`You talk for twenty-five minutes. You tell him about the phone call at 11:52 p.m. on draft night. You tell him she's the reason you're on a roster at all.${extra}`, `Near the end, the AD stops typing and just listens.`, arcNote('Okafor')];
      }, then: 'queue' },
    { label: 'Tell him the truth, and that the Hammerheads would be lost without her.', do() {
        const o = arcs().ok; o.ref = 'keep'; o.lean -= 1; fx({ coach: 1, conf: 1 });
        return [`Every word you say is true. You just choose which true things to say. Mostly you talk about how much this team needs her, and how hard it would be to replace her in the middle of a season.`, `The AD thanks you and says it was "very helpful," in a voice that means it wasn't. You feel strange about it for the rest of the day.`];
      }, then: 'queue' },
    { label: 'Keep it short and professional.', do() {
        arcs().ok.ref = 'short'; fx({ energy: 2 });
        return [`Four minutes. Punctual, demanding, fair, knows her stuff. He thanks you. It feels like you checked a box on a form.`];
      }, then: 'queue' },
    { label: 'Ask him to hold on, and call Okafor first.', do() {
        const o = arcs().ok; o.ref = 'call'; o.lean += 1; fx({ coach: 3 });
        return [`She picks up on the first ring.`, { s: 'Coach Okafor', t: `I put you down because you'll tell them the truth. So tell them the truth. Whatever you think it is.` }, `You call him back and tell him the truth. It turns out the truth takes about fifteen minutes, and most of it is good.`, arcNote('Okafor')];
      }, then: 'queue' },
  ],
});

// After the regular-season finale.
P.ok_offer = a => {
  const o = arcs().ok, next = arcAfter(a);
  const body = [
    `After the game, the locker room empties out slowly. Okafor is still in her office with the door open, which she never does.`,
    { s: 'Coach Okafor', t: `Come in. Close it.` },
    `There's a folder on her desk with a red-and-silver logo. Ridgeline State.`,
    { s: 'Coach Okafor', t: `They offered. Head coach. Five years. They want an answer by Friday, and they want me there the day after our season ends.` },
  ];
  if (o.ref === 'rave' || o.ref === 'call') body.push(`"The AD told me one of my references talked for twenty-five minutes," she says. "I wonder who that was."`);
  else if (o.ref === 'keep') body.push(`"The AD said one reference spent the whole call telling him how much the Hammerheads need me," she says, evenly. "I wonder who that was."`);
  else if (o.rumor === 'keep') body.push(`The Ledger headline is still taped to her door. *NOT GOING ANYWHERE.* She sees you looking at it.`);
  if (S.flags.callAns === 'bonus') body.push(`"You asked me about the signing bonus, that first night on the phone," she says. "I almost hung up on you. I'm glad I didn't."`);
  body.push({ s: 'Coach Okafor', t: `I've asked everybody what they'd do. My mother. Bramble. My pastor. You're the last one. What would you do?` });
  const decide = offer => {
    if (o.leaves == null) {
      let lean = o.lean + (offer === 'take' ? 2 : offer === 'stay' ? -2 : 0);
      const g = avgGrade();
      o.why = g >= 2.1 ? 'ready' : g > 0 && g < 1.5 ? 'unfinished' : 'even';
      if (o.why === 'ready') lean += 1; else if (o.why === 'unfinished') lean -= 1;
      o.offer = offer;
      o.leaves = lean >= 1;
      if (o.leaves && offer === 'take') award('tree');
    }
    return o.leaves;
  };
  return {
    kicker: postKicker(),
    title: 'The Offer',
    body,
    choices: [
      { label: '"Take it. You\'ve been building toward this your whole life."', do() {
          if (decide('take')) { fx({ coach: 6, conf: 3 }); return [`She closes the folder.`, { s: 'Coach Okafor', t: `That's what I was going to do. I just needed somebody to say it out loud.` }, `She'll finish whatever is left of this season. Then she's gone. Neither of you says anything for a while. It's a good kind of quiet.`, arcNote('Okafor')]; }
          fx({ coach: 4 }); return [`She looks at the folder for a long time. Then she slides it into a drawer.`, { s: 'Coach Okafor', t: `Not yet. I've got a rookie who isn't finished. Ask me again next year.` }, `You told her to go. She stayed anyway. You're not sure if that's a compliment or a warning. With Okafor, it's usually both.`, arcNote('Okafor')];
        }, then: next },
      { label: '"Stay. One more year. Finish what you started."', do() {
          if (decide('stay')) { fx({ coach: 2 }); return [{ s: 'Coach Okafor', t: `I know. And I love that you asked.` }, `She's going. You can tell from the way she's already looking at the whiteboard, like she's memorizing it.`, { s: 'Coach Okafor', t: `You don't need me as much as you think you do, {last}. That's my fault. I did my job too well.` }, arcNote('Okafor')]; }
          fx({ coach: 5, conf: 2 }); return [{ s: 'Coach Okafor', t: `Okay.` }, `She says it like it costs something. It does. She picks up her office phone while you're still sitting there and turns Ridgeline down in under a minute.`, { s: 'Coach Okafor', t: `Don't make me regret it, {last}.` }, arcNote('Okafor')];
        }, then: next },
      { label: '"I\'m not answering that. It\'s yours to decide."', do() {
          if (decide('yours')) { fx({ coach: 4, conf: 2 }); return [{ s: 'Coach Okafor', t: `That's the most coach-like thing a player has ever said to me.` }, `She taps the folder.`, { s: 'Coach Okafor', t: o.why === 'ready' ? `You want to know how I decided? I watched your tape from today. You don't need me standing behind you anymore. That's how I know I can go.` : `I'm going. Not because of anything you did. Because of everything you did.` }, arcNote('Okafor')]; }
          fx({ coach: 4 }); return [{ s: 'Coach Okafor', t: o.why === 'unfinished' ? `Then I'm staying. You're not done. Neither am I. I don't leave a job halfway.` : `Then I'm staying. For now. Ridgeline will survive.` }, `She drops the folder in a drawer and pulls out a stack of film. Of course she does.`, arcNote('Okafor')];
        }, then: next },
    ],
  };
};

// =========================================================
//   DANTE KINGSLEY: three Monarchs games, three handshakes
// =========================================================
P.dante_mid = a => {
  const g = S.game, won = !!(g && g.won), t = S.flags.trash, next = arcAfter(a);
  const open = won
    ? `Final whistle. For the first time all season, the Monarchs walk off a field without a win. Dante Kingsley finds you at midfield anyway, helmet under his arm.`
    : `Final whistle. Monarchs fans are already singing. Dante Kingsley jogs across the field toward you with his helmet under his arm and the crown tattoo shining under the lights.`;
  const K = t => ({ s: 'Dante Kingsley', t });
  const say = {
    fire: won ? [K(`Receipt, huh? All right. All right. I heard you.`), `He's still breathing hard.`] : [K(`Where's that receipt, rook? You want me to sign it?`)],
    cake: won ? [K(`You beat us AND you made me a cake? That's just disrespectful.`), `He's laughing.`] : [K(`Tell your big man the cake was fire. Tell him I said that. Not on the record.`)],
    quiet: won ? [K(`You don't talk, huh? You don't have to.`)] : [K(`Kept your mouth shut all week. Smart. Didn't help. But smart.`)],
  }[t] || [K(won ? `Okay, undrafted. Okay.` : `Good try, undrafted.`)];
  const set = v => { arcs().dante.post1 = v; };
  return {
    kicker: postKicker(),
    title: 'Midfield',
    body: [open, ...say],
    choices: [
      { label: 'Shake his hand. "Good game."', do() { set('shake'); danteAdd(1, 0); fx({ conf: 1 }); return [won ? `He holds the handshake a beat longer than he has to. "See you in Week 10."` : `He looks surprised. Most guys don't shake after he talks like that. "See you in Week 10, rook."`, arcNote('Kingsley')]; }, then: next },
      { label: won ? 'Point at the scoreboard.' : '"Enjoy it. Week 10 is on our field."', do() {
          set('jab'); danteAdd(0, 1); fx(won ? { fame: 4, conf: 2 } : { conf: 3 });
          return [won ? `Every camera in the building catches it. By morning it's a meme. Kingsley's podcast that week is twenty-six minutes long. Twenty-two of them are about you.` : `"Oh, it's like that?" He grins with all of his teeth. "It's like that." Somewhere, Week 10 just got circled in red marker.`, arcNote('Kingsley')];
        }, then: next },
      { label: 'Walk right past him.', do() { set('snub'); danteAdd(0, 1); fx({ conf: 1, coach: 1 }); return [`He stands at midfield with his hand out for a second too long. The cameras catch that, too.`, arcNote('Kingsley')]; }, then: next },
      { if: () => t === 'cake', label: 'Hand him the last slice of crown cake. Tiny saved it.', do() {
          set('cake'); danteAdd(2, 0); fx({ chem: 3, fame: 3 });
          return [`Tiny produces it from somewhere inside his shoulder pads. Nobody knows how.`, `Kingsley stares at the slice. He stares at Tiny. Then he eats it in two bites on the fifty-yard line while sixty-eight thousand people watch.`, { s: 'Dante Kingsley', t: `Okay. Okay. That's funny. Give me your number. Don't tell anybody.` }, arcNote('Kingsley')];
        }, then: next },
    ],
  };
};

// After the Conference Championship.
P.dante_last = a => {
  const g = S.game, won = !!(g && g.won), ds = danteState(), next = arcAfter(a);
  const scene = {
    friend: won
      ? [`The confetti is for you this time. Kingsley crosses the whole field to find you in it.`, { s: 'Dante Kingsley', t: `Go win it. Then call me. I want to hear about the parade.` }, `He takes off his chain, a gold crown on a rope as thick as a pencil, and puts it in your hand.`, { s: 'Dante Kingsley', t: `Hold this for me. I'm gonna want it back next year.` }]
      : [`You're sitting on the turf. Kingsley crouches down in front of you, blocking the cameras.`, { s: 'Dante Kingsley', t: `Hey. Look at me. Don't you dare be sad in front of these cameras. Next year you're the one with the podcast.` }],
    respect: won
      ? [`Kingsley finds you in the handshake line. He doesn't let go right away.`, { s: 'Dante Kingsley', t: `Go win it. Make me look good for losing to you.` }]
      : [`Kingsley finds you in the handshake line. His eyes are already on the Championship.`, { s: 'Dante Kingsley', t: `Third time's the charm. For me, anyway. You'll get yours. I mean that.` }],
    grudge: won
      ? [`Kingsley skips the handshake line entirely. He walks straight into the tunnel, crown tattoo and all.`, `An hour later, a text from the number you never saved: *Good game. Don't tell anybody.*`]
      : [`Kingsley walks the handshake line slowly, so he can stop in front of you.`, { s: 'Dante Kingsley', t: `Told you. Third time's the last time.` }],
  }[ds];
  const set = v => { arcs().dante.post3 = v; };
  return {
    kicker: postKicker(),
    title: 'The Third Handshake',
    body: scene,
    choices: ds === 'friend' ? [
      { label: won ? 'Put the chain on.' : 'Let him pull you up.', do() { set('friend'); fx({ conf: 4, fame: 2 }); return [won ? `It's heavier than it looks. Everything is, this week. Tiny sees it and loses his mind.` : `He pulls you up with one hand. In the tunnel, he texts you a single crown emoji. It doesn't need words.`, arcNote('Kingsley')]; }, then: next },
      { label: '"Same time next year."', do() { set('friend'); fx({ conf: 3 }); return [`"Same time next year," he says. "Bring cake."`, arcNote('Kingsley')]; }, then: next },
    ] : ds === 'respect' ? [
      { label: 'Pull him into a hug.', do() { set('hug'); danteAdd(1, 0); fx({ chem: 2, conf: 2 }); return [`He's stiff for about a second. Then he isn't. The photo runs on the front page of the Ledger the next morning: two guys who spent all season talking about each other, finally saying nothing.`, arcNote('Kingsley')]; }, then: next },
      { label: 'Shake his hand and say, "Next year."', do() { set('shake'); fx({ conf: 2 }); return [`"Next year," he agrees. It sounds like a promise. From him, it's a threat. From you, it's a promise too.`]; }, then: next },
    ] : [
      { label: won ? 'Text back: "Good game."' : 'Shake his hand anyway.', do() { set('bigger'); danteAdd(2, -1); fx({ coach: 3, conf: 2 }); return [won ? `Three dots. Then: *You still owe me a podcast apology.* It's the closest thing to a truce you're going to get, and you'll take it.` : `He's not expecting it. He looks at your hand like it might be a trick. Then he shakes it. Something in his face changes, just slightly. You can work with slightly.`, arcNote('Kingsley')]; }, then: next },
      { label: won ? 'Leave him on read.' : 'Say nothing. Walk off.', do() { set('cold'); fx({ conf: 1 }); return [won ? `You put the phone away. Some rivalries are better unfinished.` : `You walk off without a word. Some rivalries are better unfinished.`]; }, then: next },
    ],
  };
};

// =========================================================
//   FAMILY: one story per origin (two beats + the finale)
// =========================================================
P.fam_a = () => {
  const f = arcs().fam, o = S.origin;
  const kicker = weekKicker();
  if (o === 'town') return {
    kicker, title: 'Whatever\'s Not Melted',
    body: [
      `Your phone buzzes at 9 p.m. It's Coach Delgado, your old high school coach, who has eaten breakfast at the Bluebird every morning for twenty years.`,
      { s: 'Coach Delgado', t: `I'm not supposed to tell you this. The walk-in freezer at the Bluebird died in August. Bea's been buying forty bags of gas-station ice every morning and not raising the price of pie. The bank sent a letter. She keeps it under the register.` },
      `Grandma Bea has called you four times this week. She hasn't mentioned any of it. She asked if you were wearing a jacket.`,
    ],
    choices: [
      { if: () => S.st.money >= 20000, label: 'Wire money for a new freezer. Don\'t ask permission.', sub: 'Costs $20,000', do() { f.a = 'money'; fx({ money: -20000, family: 5, conf: 2 }); return [`The new freezer is installed by Friday. Grandma Bea calls that night, and she is not happy.`, { s: 'Grandma Bea', t: `I did not raise you to spend your money on my problems.` }, `A long pause.`, { s: 'Grandma Bea', t: `It's a very nice freezer.` }, `She sends a photo of herself standing next to it like it's a new grandchild.`, arcNote('Grandma Bea')]; }, then: 'queue' },
      { label: 'Call her and ask her straight.', do() { f.a = 'honest'; fx({ family: 8, conf: 2 }); return [`"Delgado has a big mouth," she says. Then she tells you everything: the freezer, the letter, and the new Waffle Barn off the highway that does pancakes for $3.99.`, { s: 'Grandma Bea', t: `I'll figure it out, sugar. I always have. Don't you dare send money.` }, `You promise. You both know you're going to think about it.`, arcNote('Grandma Bea')]; }, then: 'queue' },
      { label: 'Get the locker room involved.', do() { f.a = 'team'; fx({ chem: 5, fame: 3, energy: -6 }); return [`Tiny hears about it before you finish the sentence. By Thursday, the whole offensive line has signed a helmet for an online auction: ALL PROCEEDS TO THE BLUEBIRD.${S.rel.vane >= 20 ? ' Vane signs it too, without being asked.' : ''}`, `It sells for $14,200 to a man in Wichita who wants to know if the pie is really that good. (It is.)`, arcNote('Grandma Bea')]; }, then: 'queue' },
      { label: 'Stay out of it. She\'d hate that you know.', do() { f.a = 'none'; fx({ family: -3, energy: 3 }); return [`You don't call. You tell yourself it's respect.`, `On Sunday, Grandma Bea texts you a photo of the Bluebird's chalkboard. TODAY'S SPECIAL: WHATEVER'S NOT MELTED.`]; }, then: 'queue' },
    ],
  };
  if (o === 'city') return {
    kicker, title: 'Nine Minutes',
    body: [
      `3:12 a.m. Your phone buzzes on the nightstand. It's Mom, on her break.`,
      { s: 'Mom', t: `Sorry, baby. I know it's late. I just wanted to hear a voice that wasn't beeping.` },
      `She's been picking up doubles since August. The ER is short four nurses, and she has never once said no to a short shift. She asks about your hamstrings, your apartment, and whether you're eating vegetables. She does not mention how tired she sounds.`,
      { s: 'Mom', t: `I put in for a Sunday off. Week ten, the Monarchs game. The charge nurse laughed at me. But she didn't say no.` },
    ],
    choices: [
      { label: 'Offer to cover her bills so she can drop the doubles.', do() { f.a = 'money'; fx({ family: 4, money: -1680 }); return [`"Absolutely not," she says, so fast you know she practiced it. "I like my job. And that's your money."`, `She does let you pay for her hospital parking pass, which is $140 a month and, she admits, a crime.`, arcNote('Mom')]; }, then: 'queue' },
      { label: 'Send dinner to the whole night shift.', sub: 'Costs $1,500', do() { f.a = 'nurses'; fx({ money: -1500, family: 8, fame: 2 }); return [`At 4 a.m. a delivery driver walks into the ER with thirty-one dinners and a note: FOR MOM'S CREW. FROM #{num}.`, `Mom sends a photo: nine nurses in scrubs, holding up plates, one of them doing your celebration slightly wrong. The night shift has a new favorite player.`, arcNote('Mom')]; }, then: 'queue' },
      { label: 'Stay on the phone for her whole break.', do() { f.a = 'talk'; fx({ family: 6, conf: 3, energy: -3 }); return [`Nine minutes. You tell her about Tiny's cereal, Okafor's 4:30 alarm, and the playbook that reads like a tax form.`, `She laughs twice. The second time, she laughs so hard a patient asks if she's okay.`, arcNote('Mom')]; }, then: 'queue' },
    ],
  };
  return {
    kicker, title: 'The Binder',
    body: [
      `A box arrives at your apartment. Inside is a three-ring binder, two inches thick, with tabbed dividers: SLEEP. HYDRATION. FILM. OPPONENT. MISC.`,
      `The MISC tab is a single laminated card that says MAKE YOUR BED.`,
      { s: 'Dad', t: `0600 phone call every morning, starting tomorrow. We'll go over the day. Like old times.` },
      `Dad has been running your schedule since you were six. He's very good at it. You are twenty-two.`,
    ],
    choices: [
      { label: 'Follow the binder. He knows what he\'s doing.', do() { f.a = 'binder'; fx({ skill: 3, energy: 6, family: 4, conf: -2 }); return [`0600, every morning. He's never late. By Friday you're sleeping better than you have in months, and you feel like you're nine years old. Both things are true.`, arcNote('Dad')]; }, then: 'queue' },
      { label: 'Tell him, gently, that you\'ve got it from here.', do() { f.a = 'letgo'; fx({ conf: 6, family: -3 }); return [`It's a long silence. Long enough that you check whether the call dropped.`, { s: 'Dad', t: `Roger that.` }, `He hangs up. The next morning at 0600, your phone doesn't ring. At 0603, a text: *Proud of you. Bed made?*`, arcNote('Dad')]; }, then: 'queue' },
      { label: 'Ask him to tell you about his first year in the Army instead.', do() { f.a = 'story'; fx({ family: 10, conf: 2 }); return [`He's quiet for so long you think he's going to change the subject.`, `Then he tells you a story you've never heard: a nineteen-year-old private from nowhere, a sergeant who swore he'd wash out in a week, and the twenty years he stayed just to prove the man wrong.`, `You talk for an hour. Neither of you mentions the binder. You use it anyway. Mostly the MISC tab.`, arcNote('Dad')]; }, then: 'queue' },
    ],
  };
};

P.fam_b = () => {
  const f = arcs().fam, o = S.origin;
  const kicker = weekKicker();
  if (o === 'town') {
    const state = { money: `The new freezer is full of pie.`, honest: `Grandma Bea still won't let you send money. She did let the Waffle Barn manager eat at the counter once, so she could watch his face when he tried the pancakes.`, team: `The auction money paid for a freezer and the bank letter. A photo of the signed helmet hangs above the register.`, none: `The ice bill is still the ice bill. Delgado says she's been closing at two on weekdays to save on the lights.` }[f.a] || '';
    return {
      kicker, title: 'Eighty-Eight Seats',
      body: [
        `Cutter's Ford is throwing a watch party for the season finale. At the Bluebird, of course. Population 2,140, and the fire marshal says the diner holds eighty-eight.`,
        state,
        { s: 'Grandma Bea', t: `The whole town's coming. I'm making a pie in the shape of your number. Win or lose, they're coming for the pie. But win.` },
        S.flags.helmets === 'check' || S.flags.helmets === 'fund' ? `Coach Delgado says the high school team is coming too, in their new helmets. They plan to wear them the whole time.` : '',
      ],
      choices: [
        { label: 'Record a video for the party: free pie if you win.', do() { f.b = 'video'; fx({ family: 6, fame: 2 }); return [`You film it in the locker room. Tiny photobombs it holding a fork. By Saturday the video has been shared by every person in Cutter's Ford and several cows.`, arcNote('Grandma Bea')]; }, then: 'queue' },
        { label: 'Buy the Bluebird a big-screen TV.', sub: 'Costs $3,000', do() { f.b = 'tv'; fx({ money: -3000, family: 6 }); return [`The old TV has a green stripe through the middle of it. The new one is so big Coach Delgado has to take the front door off its hinges to get it inside.`, arcNote('Grandma Bea')]; }, then: 'queue' },
        { label: 'Write BLUEBIRD on your wrist tape for the game.', do() { f.b = 'tape'; fx({ family: 4, conf: 2 }); return [`Black marker, block letters, both wrists. Rocco watches you do it and hands you a better marker.`, arcNote('Grandma Bea')]; }, then: 'queue' },
      ],
    };
  }
  if (o === 'city') {
    const crew = f.a === 'nurses';
    return {
      kicker, title: 'The Night Off',
      body: [
        `It's official. Mom has Sunday off for the finale. A real day off, not traded and not borrowed.`,
        S.flags.famAtGame ? `She came to the opener, and paid for it with two overnights. This one is free and clear.` : `It will be the first time she has ever seen you play as a pro in person, instead of on a phone propped against a vending machine.`,
        crew ? `The night shift has decided they're coming too. Nine nurses, one minivan, matching shirts.` : '',
        { s: 'Mom', t: `I bought a new coat. Don't make it a whole thing.` },
      ],
      choices: [
        { label: 'Get her seats in the family section, next to Tiny\'s mom.', do() { f.b = 'section'; fx({ family: 6, chem: 2 }); return [`You set it up with Tiny. He says his mom has been "dying to meet the nurse lady." You did not know there was a nurse lady. You are apparently the last to know things.`, arcNote('Mom')]; }, then: 'queue' },
        { label: 'Get her a sideline pass for warmups.', do() { f.b = 'field'; fx({ family: 8 }); return [`Rocco says he'll walk her out of the tunnel himself. "Nurses outrank everybody," he says. "Even Bramble. Especially Bramble."`, arcNote('Mom')]; }, then: 'queue' },
        { if: () => crew || S.st.fame >= 30, label: 'Ask the team to honor her on the big screen.', do() { f.b = 'screen'; fx({ family: 10, fame: 2 }); return [`You call the team's game-day staff. It's a small ask. They say yes in about four seconds.`, `You don't tell her. You tell the night shift. The night shift is very bad at keeping secrets, but very good at keeping this one.`, arcNote('Mom')]; }, then: 'queue' },
      ],
    };
  }
  return {
    kicker, title: 'Section 112',
    body: [
      `Dad calls at noon. Not at 0600. At noon, which is how you know it's important.`,
      { s: 'Dad', t: `The finale. I want to come. Inside, this time.` },
      S.flags.dadLot ? `The last time he tried, he made it to the parking lot.` : `He hasn't been inside a stadium since he came home. Sixty-eight thousand people is a lot of noise for a man who spent twenty years listening for the wrong kind.`,
      `He's asking you how to do it without asking you how to do it.`,
    ],
    choices: [
      { label: 'Get him an aisle seat by the tunnel, and Rocco\'s number.', do() { f.b = 'aisle'; fx({ family: 8 }); return [`Section 112, row 4, on the aisle, ten steps from a tunnel. Rocco gives him a lanyard and his cell number.`, `"Anything you need, Sergeant. You want out, I'll walk you out." Dad writes the number on the back of his hand in pen, in case the phone dies. He's always had a plan B.`, arcNote('Dad')]; }, then: 'queue' },
      { label: 'Bring him in at 8 a.m., before anybody else is there.', do() { f.b = 'early'; fx({ family: 8, coach: 2 }); return [`He walks onto the empty field at 8:02 a.m. You watch his shoulders come down an inch at a time.`, `He says the grass is better than it looks on TV. When the gates open, he's already in his seat. He likes to be early. You come by it honestly.`, arcNote('Dad')]; }, then: 'queue' },
      { label: 'Tell him he doesn\'t have to prove anything. The parking lot counts.', do() { f.b = 'lot'; fx({ family: 4, conf: 2 }); return [{ s: 'Dad', t: `I know it counts. I want to go in anyway. I'll figure out the how.` }, `It's the first time you've ever heard him say he'd figure something out instead of telling you the plan.`, arcNote('Dad')]; }, then: 'queue' },
    ],
  };
};

// Pregame and postgame lines for the finale (slate 9), by origin and choice.
function famFinalePre() {
  const f = arcs().fam, o = S.origin;
  if (!f.b) return '';
  if (o === 'town') return `Somewhere in Cutter's Ford, eighty-eight people are packed into the Bluebird${f.b === 'tv' ? ' around a TV so big the door is still off its hinges' : ''}. Grandma Bea is in the middle of them, holding a pie shaped like the number {num}.`;
  if (o === 'city') return f.b === 'field' ? `During warmups, Mom stands at the mouth of the tunnel in her new coat, next to Rocco, watching sixty-eight thousand empty seats fill up. Okafor shakes her hand. Bramble nods at her, which Okafor tells her is basically a hug.`
    : f.b === 'screen' ? `Mom is in the stands. Not on a phone propped against a vending machine. In the stands. You know what's coming in the second quarter. She doesn't.`
    : `Mom is in the family section in her new coat, next to Tiny's mom, Losa Fonoti. By the end of warmups they've swapped numbers, recipes, and opinions about your offensive line.`;
  return f.b === 'aisle' ? `Section 112, row 4, on the aisle. Dad is there forty minutes before kickoff, with Rocco's number written on the back of his hand.`
    : f.b === 'early' ? `Dad has been in his seat since the gates opened. He was the first person in Section 112. He'll tell you that later, twice.`
    : `During warmups, you look up at Section 112. Dad's seat is empty.`;
}
function famFinalePost(won) {
  const f = arcs().fam, o = S.origin;
  if (!f.b) return '';
  if (o === 'town') return f.b === 'video' ? (won ? `Back in Cutter's Ford, Grandma Bea gives away 212 slices of free pie. The diner holds eighty-eight people. Nobody can explain the math.` : `Back in Cutter's Ford, Grandma Bea gives away the free pie anyway. "The video didn't say you had to win," she tells you. "I checked."`)
    : f.b === 'tv' ? `Coach Delgado texts a photo from the Bluebird: eighty-eight people around the giant TV, every one of them with a fork in the air.`
    : `In the fourth quarter, the broadcast zooms in on your wrist tape. BLUEBIRD. The announcer asks, "What's a Bluebird?" By Monday the whole country knows, and the diner's phone hasn't stopped ringing.`;
  if (o === 'city') return f.b === 'screen' ? `In the second quarter, the big screen fills with Mom in her new coat: TONIGHT'S HOMETOWN HERO, NIGHT-SHIFT ER NURSE. Sixty-eight thousand people stand up. She tries to sit back down. ${f.a === 'nurses' ? 'Nine nurses in matching shirts' : 'The people around her'} won't let her.`
    : f.b === 'field' ? `After the game, Mom is waiting at the tunnel where she stood during warmups. She says the grass smelled exactly the way she thought it would.`
    : `After the game, Mom and Tiny's mom, Losa, are waiting at the family exit, arm in arm, like they've known each other for thirty years.`;
  return f.b === 'aisle' ? `He stayed. All four quarters. He used Rocco's number once, to ask where to get you a hot dog for after.`
    : f.b === 'early' ? `He stayed all four quarters. In the fourth, when the whole stadium stands up, he stands up with it.`
    : `At halftime you look up at Section 112, and there he is, at the rail. He came in on his own. He stays for the whole second half.`;
}

// The family paragraph in the epilogue (FAMILY_RICH / FAMILY_MODEST in 40-story.js read this).
function famCoda(rich) {
  const f = isY1() ? arcs().fam : {}, o = S.origin;
  if (o === 'town') {
    if (!f.a && !f.b) return rich ? `With your first-year money, you put a new roof on the Bluebird Diner. Grandma Bea hangs your jersey next to the pie case and charges a dollar for photos with it. All proceeds go to pie.` : `Grandma Bea frames your first game check stub and hangs it in the diner, right above the register.`;
    if (!dinerSaved()) return `In March, Grandma Bea sells the Bluebird to the Henderson girl, who keeps the name, the pie, and Bea, on Tuesdays. You offer to buy it back. "Thirty-one years of pancakes, sugar," she says. "I'd like to eat one somebody else made."${rich ? ' You buy her a house with a big porch instead. She puts a pie case on it.' : ''}`;
    const base = rich ? `With your first-year money, you put a new roof on the Bluebird Diner. Grandma Bea hangs your jersey next to the pie case and charges a dollar for photos with it. All proceeds go to pie.`
      : `The Bluebird stays open. Grandma Bea frames your first game check stub and hangs it above the register, next to the bank letter, which is now stamped PAID.`;
    const bit = f.b === 'tape' ? ` People drive in from three states to ask what a Bluebird is. She tells them, then sells them pie.`
      : f.a === 'honest' ? ` After the watch party, she finally lets you help. She calls it a loan and keeps the ledger in pencil, so she can erase it later.`
      : f.a === 'team' ? ` The man from Wichita mails the signed helmet back to her with a note: *The pie IS that good.*`
      : f.a === 'money' ? ` The freezer hums in the back like it's proud of itself.` : '';
    return base + bit;
  }
  if (o === 'city') {
    const base = rich ? `With your first-year money, you pay off Mom's mortgage. She still works her night shifts. "I like my job," she says. "You'll understand when you're older."`
      : `Mom tapes a newspaper clipping of you to the fridge at the nurses' station. Somebody adds googly eyes to it.`;
    const bit = f.b === 'screen' ? ` The video of sixty-eight thousand people standing up for her has nine million views. She has watched it once. The night shift has watched it for her, several thousand times.`
      : f.b === 'field' ? ` She keeps the sideline pass clipped to her badge at work. Patients ask about it. She tells them the whole story, every time, at length.`
      : f.b === 'section' ? ` She and Losa Fonoti text every Sunday now. You are not in the group chat. You have asked.`
      : f.a === 'nurses' ? ` The night shift still calls itself Team {LAST}.` : '';
    return base + bit;
  }
  const base = rich ? `With your first-year money, you buy Dad the fishing boat he's talked about since you were six. He names it *Undrafted* and makes you swab the deck.`
    : `Dad salutes you at the airport on the way home. In front of everyone. You pretend to be embarrassed.`;
  const bit = f.b === 'lot' ? ` He says next season he's coming in for kickoff. You believe him.`
    : f.b ? ` The ticket stub from Section 112 lives in his wallet now, behind his old Army ID.` : '';
  const bit2 = f.a === 'letgo' ? ` He calls on Sundays now, not at 0600. You make your bed anyway.`
    : f.a === 'story' ? ` He has more stories from his first year in the Army, it turns out. He's been saving them for you.`
    : f.a === 'binder' ? ` The binder has a second volume. You asked for it.` : '';
  return base + bit + bit2;
}

// ---------- Two new endings ----------
ENDINGS.tree = { title: 'The Coaching Tree', body: () => {
  const o = arcs().ok;
  return [
    `Coach Okafor's last day in the Hammerheads building is a Tuesday in January. She gets there at 4:30 a.m. Of course she does. You get there at 4:25, and for the first time all year, you beat her.`,
    `Her office fits in four boxes. Three are film. The fourth is a mug, a whistle, and a stack of index cards, one for every player she ever coached here, with three bullet points on each in tiny handwriting. Yours is on top. She doesn't let you read it.`,
    `She saves the whiteboard for last. Your name is still on it from a Tuesday in October, circled twice. She doesn't erase it. She takes a picture of it, caps the marker, and hands it to you.`,
    { s: 'Coach Okafor', t: `Every coach has a tree. The people they made better, who go off and make other people better. You're my first branch, {last}. Don't make me look bad.` },
    o.offer === 'take' ? `You told her to take the job, and you meant it. Watching her minivan pull out of the lot, you still have to sit down on the curb for a minute.`
      : o.offer === 'stay' ? `You asked her to stay. She went anyway. Standing in her empty office, you finally understand why she had to, and that it was never about you not being enough.`
      : `You told her it was her call, and she made it. Standing in her empty office, you understand that you're part of the reason she could go.`,
    `In September, Ridgeline State wins its first game under its new head coach. You watch it on a laptop in the team hotel while Tiny screams at every snap. After the final whistle, the camera finds her on the sideline. She looks straight into the lens, taps her watch, and mouths two words: *Four-thirty.*`,
  ];
} };

ENDINGS.favorite = { title: 'The People\'s Rookie', body: () => {
  const cb = S.flags.trash === 'cake' ? `The crown-cake photo is pinned up in the Monarchs' locker room now. Dante Kingsley put it there himself.`
    : S.flags.zapp === 'honest' ? `The ZAPP! ad still runs during every game. Kids shout "It tastes like a battery!" at you in airports. You shout it back.`
    : S.flags.viral === 'post' || S.flags.viral === 'line' ? `Somewhere right now, a kid is doing {fam}'s victory dance at a birthday party. It's not your dance anymore. It's everybody's.`
    : S.flags.draftNight === 'receipts' ? `You open the RECEIPTS folder on your phone. Nineteen screenshots. You don't need them anymore. You delete them.`
    : `You keep every letter the fans send. By March you need a second shoebox.`;
  return [
    `There's no ring this year. There's something stranger.`,
    `The fans vote for the team's Rookie of the Year, and it isn't close. It isn't close the way an election isn't close when one of the candidates is a golden retriever. Ninety-one percent.${S.items.blitz ? ' Blitz got four percent as a write-in.' : ''} Somebody in the front office checks the math twice.`,
    `On the east side of Harbor City, someone paints a mural of you on the side of a laundromat: forty feet tall, ${S.pos === 'RB' ? 'mid-stride' : 'mid-{verb}'}, wearing number {num}. It isn't a great likeness. You love it more than anything you own.`,
    `On the last day, Tiny stands on a bench and gets the whole locker room chanting your name. Bramble walks in halfway through. He waits for them to finish. Then he says your name once, quietly, and walks out. Nobody can explain why that's the loudest part.`,
    cb,
    `Two hundred and fifty-seven players got drafted ahead of you. Not one of them has a laundromat.`,
  ];
} };

// ---------- Epilogue lines for the arcs (pushed onto CODAS in 58-arcs-wire.js) ----------
function okafCoda() {
  const o = arcs().ok;
  if (o.leaves == null || S.flags.ending === 'tree') return null;
  const side = S.pos === 'LB' ? 'defensive' : 'offensive';
  if (o.leaves) return `In September, Ridgeline State wins its first game under Nina Okafor. That night she texts you a link to a high school highlight tape: an undersized kid with no scholarship offers. *Nobody's calling him,* she writes. *Remind you of anybody?*`;
  if (o.offer === 'stay') return `Ridgeline hires somebody else. Okafor never mentions it. In March, Bramble makes her the Hammerheads' ${side} coordinator, and once, at 4:30 in the morning, you catch her watching Ridgeline's spring game on her phone. She puts it away when she sees you. She smiles first.`;
  return `Okafor tells the Ledger she turned Ridgeline down because "the job here isn't finished." In March, Bramble makes her the Hammerheads' ${side} coordinator. Her first act is moving the morning meeting to 4:45, as a kindness.`;
}
function tinyCoda() {
  const t = arcs().tiny;
  if (!t.fate && !t.truck) return null;
  const truck = truckSaved() ? ` Mama Fonoti's parks outside the stadium on game days now${t.truck === 'money' ? ', and THE {LAST} is still the best seller' : t.truck === 'sly' ? ', still wrapped in Sly\'s enormous face' : ''}.` : t.truck ? ` In the spring, the truck finally gets its new generator, paid for one delivery at a time.` : '';
  const f = {
    three: `Tiny signs his extension at a press conference in December. He thanks his mom, Losa, his grandmother, Nana Fonoti, "and my rookie," in that order. His tie has little food trucks on it.`,
    two: `Tiny plays out his two years and says he'll take two more after that. "Two's a whole lot of cereal," he tells the Ledger.`,
    one: `Tiny has knee surgery in January. He sends you a photo from the recovery room: thumbs up, hospital gown, a bowl of cereal balanced on his chest. He's coming back. He has one year to prove it, and he's never needed more than one of anything.`,
    market: `Tiny tests free agency and signs a huge deal with the Gulf Coast Hurricanes. He cries at the press conference. You'll play against him twice a year now. He has promised to take it easy on you. He is lying.`,
    gamble: `Tiny tests the market on a bad knee, and the phone barely rings. He has surgery in March and re-signs with the Hammerheads in April, for less than the original offer. "Should've listened to my mom," he says. He's smiling anyway. He's home.`,
    sly: `Sly Pemberton gets Tiny the biggest contract an offensive lineman signs all year, in Neon City. The locker next to yours stays empty all spring. Nobody will take it. Somebody leaves a box of cereal in it.`,
  }[t.fate] || `Tiny's contract talks drag into the spring. He doesn't worry about it out loud, which is how you know he's worried.`;
  return f + truck;
}
function danteCoda() {
  const d = arcs().dante;
  if (d.g4 == null && !S.flags.trash) return null;
  const ds = danteState();
  if (ds === 'friend') return S.flags.trash === 'cake'
    ? `In the offseason, Dante Kingsley invites you on his podcast. The episode is called "The Cake Guy." It's three hours long. Tiny is on for two of them.`
    : `In the offseason, Dante Kingsley invites you on his podcast. You talk for three hours. The clip that goes viral is the two of you arguing about whether cereal is soup.`;
  if (ds === 'grudge') return `Dante Kingsley ends his podcast's season finale with your name and a crown emoji. The first Monarchs game next season is already circled on both your calendars, in red.`;
  return `On his podcast's season finale, Dante Kingsley lists the five players he least likes playing against. You're number three. "Number two next year," he says. "Probably one."`;
}
// One extra callback in the epilogue, if any of these happened.
function smallCoda() {
  if (S.flags.sandwich === 'triple') return `The sandwich named after you is still on the menu. It has gained two more layers. Nobody has ever finished one, including you.`;
  if (S.flags.zapp === 'honest') return `ZAPP! Hydration renews your commercial for next season. The new slogan, printed on every bottle, is "It Tastes Like a Battery." Sales triple.`;
  if (S.flags.dinner === 'refused') return `At the end-of-season party, the veterans present you with a framed photo of your car on the fifty-yard line, wrapped in tape. It's signed by the whole team. It's the second-best thing you own.`;
  if (S.flags.club === 'photo') return `The photo of you on top of the booth at Club Velvet is still taped inside your locker. Bramble had it laminated.`;
  return null;
}

// ---------- "Where they landed": a recap of the arcs on the ending page ----------
function arcSummary() {
  const a = arcs(), rows = [];
  const o = a.ok;
  if (o.leaves != null) {
    rows.push({ who: 'Coach Okafor', tag: o.leaves ? 'Head coach, Ridgeline State' : 'Still a Hammerhead',
      line: o.leaves ? { take: 'You told her to take it.', stay: 'You asked her to stay. She went anyway, and thanked you for asking.', yours: 'You let her decide. She decided you were ready.' }[o.offer]
        : { take: 'You told her to go. She said, "Not yet."', stay: 'You asked her to stay. She did.', yours: 'You let her decide. She decided she wasn\'t done with you.' }[o.offer] });
  } else if (o.rumor) rows.push({ who: 'Coach Okafor', tag: 'Still deciding', line: 'Ridgeline is still calling.' });
  const t = a.tiny;
  if (t.knee || t.truck || t.fate) {
    const tag = { three: 'Three more years', two: 'Two more years', one: 'One-year deal', market: 'Got paid elsewhere', gamble: 'Surgery, then home', sly: 'Signed with Sly' }[t.fate] || 'Still next to you';
    const knee = { secret: 'You kept his secret.', shaw: 'You told Dr. Shaw about the knee.', nudge: 'You walked him to Dr. Shaw.', stall: 'You told him to get the knee checked. He didn\'t.' }[t.knee] || '';
    const truck = { money: 'You paid for the generator.', time: 'You sold out the truck in an apron.', slow: 'You worked the truck for sixty-one plates.', margaret: 'Margaret found the grant.', sly: 'Sly wrapped the truck in his own face.', out: 'You stayed out of the truck business.' }[t.truck] || '';
    const deal = { sign: 'You told him to sign.', market: 'You told him to bet on himself.', margaret: 'Margaret read the contract.', sly: 'You put Sly on the phone.', gm: 'You went to the GM for him.' }[t.deal] || '';
    rows.push({ who: 'Tiny', tag, line: [knee, truck, deal].filter(Boolean).join(' ') });
  }
  const d = a.dante;
  if (S.flags.trash || d.g4 != null) {
    const [w, l] = danteRecord(), ds = danteState();
    const how = { fire: 'You brought a receipt.', cake: 'You sent a crown cake.', quiet: 'You said nothing and let the tape talk.' }[S.flags.trash] || '';
    rows.push({ who: 'Dante Kingsley', tag: { friend: 'Friends. Don\'t tell anybody.', respect: 'Mutual respect', grudge: 'Grudge match' }[ds], line: `${how}${w + l ? ` You went ${w}-${l} against the Monarchs.` : ''}`.trim() });
  }
  const f = a.fam;
  if (f.a || f.b) {
    const tag = S.origin === 'town' ? (dinerSaved() ? 'The Bluebird stays open' : 'The Bluebird changes hands')
      : S.origin === 'city' ? ({ screen: 'Hometown hero', field: 'On the field', section: 'Family section' }[f.b] || 'Still on nights')
      : ({ aisle: 'All four quarters', early: 'First one in', lot: 'In by halftime' }[f.b] || 'Still in the parking lot');
    const line = {
      money: S.origin === 'town' ? 'You bought the freezer.' : 'You offered to cover her bills.', honest: 'You asked her straight.', team: 'The locker room auctioned a helmet.', none: 'You stayed out of it.',
      nurses: 'You fed the night shift.', talk: 'You stayed on for her whole break.',
      binder: 'You followed the binder.', letgo: 'You told him you had it from here.', story: 'You asked about his first year in the Army.',
    }[f.a] || '';
    rows.push({ who: '{fam}', tag, line });
  }
  const v = S.rel.vane;
  rows.push({ who: 'Marcus Vane', tag: { retired: 'Retired. Torch passed.', signed: 'Signed elsewhere. Still texts.', quiet: 'Released. "Eyes up, rook."', released: 'Released. No goodbye.' }[vaneFate(v)],
    line: [{ coach: 'You asked him to coach you.', bbq: 'You brought him barbecue while he was in the boot.', alone: 'You left him alone in the training room.' }[S.flags.rehab] || '',
      { speech: 'You spoke after him.', talk: 'You found him after the meeting.' }[a.vane] || ''].filter(Boolean).join(' ') });
  return rows;
}
function arcSummaryHTML() {
  const rows = arcSummary();
  if (rows.length < 2) return '';
  const mono = n => `<span class="arc-mono" aria-hidden="true">${esc(n.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase())}</span>`;
  const items = rows.map(r => {
    const name = plain(r.who);
    let art = '';
    try { art = UI.portrait ? UI.portrait(name, r.who) : ''; } catch (e) { art = ''; }
    return `<li class="arc-row"><span class="arc-art" aria-hidden="true">${art || mono(name)}</span><div class="arc-txt"><div class="arc-top"><b class="arc-who">${esc(name)}</b><span class="arc-tag">${fmt(r.tag)}</span></div>${r.line ? `<p class="arc-line">${fmt(r.line)}</p>` : ''}</div></li>`;
  }).join('');
  return `<section class="arc-land" aria-label="Where they landed"><div class="ending-mark">Where they landed</div><ul class="arc-list">${items}</ul></section>`;
}
