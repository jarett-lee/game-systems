# game-systems

A collection of reusable game systems and the mechanics they're built from, shown through interactive demos. Not full games.

## Language

**Game Mechanic**:
A single rule, action, or "verb" that defines one interaction point, such as jumping over a gap, checking a 1-to-100 strength stat, or moving a knight in an L-shape.
_Avoid_: Feature, ability, action (when meaning the rule itself)

**Game Object**:
A "noun" in the game, such as a weapon, an item, or a character, that mechanics act on.
_Avoid_: Entity, thing

**Game System**:
A larger framework made of several combined mechanics and game objects that feed into each other, such as a combat system (damage calculation, armor rules, weapon durability, stagger states) or an item shop with an upgrade path.
_Avoid_: Module, engine, feature

## Publishing

**Demo**:
An interactive web page that shows one Game System in action, with its settings exposed so the viewer can play with them. Not a game: no goals, progression, or win state.
_Avoid_: Example, playground, sample

**Showreel**:
A scripted sequence built into a Demo that plays the System by itself, so it can be recorded the same way every time.
_Avoid_: Autoplay, attract mode, script

**Publishing Platform**:
A website a Post is published to, such as X, Bluesky, YouTube Shorts, Instagram, dev.to, or jarett-lee.com.
_Avoid_: Channel, site, network, outlet

**Post**:
Everything published about one Game System on one Publishing Platform at one time. A System can have any number of Posts on a platform over time.
_Avoid_: Clip, tweet, update, article

**Post Element**:
One piece of a Post: a video, a blog post, a caption, hashtags, or keywords. Which Post Elements a Post has depends on its Publishing Platform. A Showreel recording, with a human voiceover, produces the video Post Element.
_Avoid_: Asset, attachment, part
