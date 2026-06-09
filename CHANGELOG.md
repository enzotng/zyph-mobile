# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [1.3.0](https://github.com/enzotng/zyph-mobile/compare/v1.2.1...v1.3.0) (2026-06-09)


### Features

* intelligent packing lists and agentic Zo copilot ([#138](https://github.com/enzotng/zyph-mobile/issues/138)) ([43ef5da](https://github.com/enzotng/zyph-mobile/commit/43ef5daaf111c0625e485a76d4db261716546e3b))
* **notifications:** add in-app notification feed and preferences ([#133](https://github.com/enzotng/zyph-mobile/issues/133)) ([b0f5439](https://github.com/enzotng/zyph-mobile/commit/b0f5439a41e48b4b0632b6af2bbf580041593e02))
* **packing:** group readiness board, traveler filter and dup warning ([#141](https://github.com/enzotng/zyph-mobile/issues/141)) ([10dcb13](https://github.com/enzotng/zyph-mobile/commit/10dcb1330589cd74b36df9360c9c90f832b1f731))
* **packing:** group split, claim, nudge and assignment notifications ([#140](https://github.com/enzotng/zyph-mobile/issues/140)) ([270e580](https://github.com/enzotng/zyph-mobile/commit/270e580c67183e2d667e9223fffc29590ad7a977))
* **packing:** smarter AI, UI/animation overhaul, and keyboard-aware sheets/forms ([#139](https://github.com/enzotng/zyph-mobile/issues/139)) ([ac8bca5](https://github.com/enzotng/zyph-mobile/commit/ac8bca5f996fa98789e6fea4e1ab48b4ca82e4bc))
* **packing:** split shared items as expenses and add J-2 reminders ([#142](https://github.com/enzotng/zyph-mobile/issues/142)) ([7f30565](https://github.com/enzotng/zyph-mobile/commit/7f30565ec2ca23b2f819a09ea7393fb12c89f545))
* **settlements:** add payment history with reversal ([#134](https://github.com/enzotng/zyph-mobile/issues/134)) ([afdf9ab](https://github.com/enzotng/zyph-mobile/commit/afdf9ab7b05675da00f8c27ae90287f51cad130f))
* **trips:** autocomplete destination and store its coordinates ([#137](https://github.com/enzotng/zyph-mobile/issues/137)) ([b780106](https://github.com/enzotng/zyph-mobile/commit/b780106e9b9f99cb838b4d767e83b2854dcfe552))
* **weather:** add destination weather on the trip dashboard ([#136](https://github.com/enzotng/zyph-mobile/issues/136)) ([30b2b49](https://github.com/enzotng/zyph-mobile/commit/30b2b49a1619da6cd575fcd255ba025d025d763b))


### Bug Fixes

* **api:** lock financial-ledger tables to their RPC write paths ([#135](https://github.com/enzotng/zyph-mobile/issues/135)) ([66be7c6](https://github.com/enzotng/zyph-mobile/commit/66be7c633b8f5b6357789907e012a2c0f6ff2645))

## [1.2.1](https://github.com/enzotng/zyph-mobile/compare/v1.2.0...v1.2.1) (2026-06-05)


### Features

* **auth:** add Google sign-in (OAuth/PKCE) ([#127](https://github.com/enzotng/zyph-mobile/issues/127)) ([4fbe295](https://github.com/enzotng/zyph-mobile/commit/4fbe295))
* **auth:** password reset + join a trip from the empty state ([#128](https://github.com/enzotng/zyph-mobile/issues/128)) ([a9468ae](https://github.com/enzotng/zyph-mobile/commit/a9468ae))
* **ui:** animation, haptics, skeleton and a11y polish pass ([#129](https://github.com/enzotng/zyph-mobile/issues/129)) ([671bd74](https://github.com/enzotng/zyph-mobile/commit/671bd74))


### Bug Fixes

* **auth:** handle the zyph://auth/callback deep link ([#130](https://github.com/enzotng/zyph-mobile/issues/130)) ([a5e19c5](https://github.com/enzotng/zyph-mobile/commit/a5e19c5))


## [1.2.0](https://github.com/enzotng/zyph-mobile/compare/v1.1.0...v1.2.0) (2026-06-04)


### Features

* **api:** add trip cover photos and batched balances for the list ([#102](https://github.com/enzotng/zyph-mobile/issues/102)) ([26fe022](https://github.com/enzotng/zyph-mobile/commit/26fe022685b6d4d89d19b4bbc8f9ebd990927b75))
* **copilot:** add Zo, a trip-scoped AI chat copilot ([#116](https://github.com/enzotng/zyph-mobile/issues/116)) ([868eb6a](https://github.com/enzotng/zyph-mobile/commit/868eb6ab0b4dd5930890081e4450c20b2356438d))
* **expenses:** make Smart Split lines editable and always saveable ([#115](https://github.com/enzotng/zyph-mobile/issues/115)) ([7631280](https://github.com/enzotng/zyph-mobile/commit/76312802076f67d05520e5274cdff7c4688bd80a))
* **i18n:** localize every screen and polish the app to the prototype ([#108](https://github.com/enzotng/zyph-mobile/issues/108)) ([85cd415](https://github.com/enzotng/zyph-mobile/commit/85cd41564bc68833b8a72ced86b906734df53499))
* **i18n:** set up i18next with fr and en locales ([48b8f87](https://github.com/enzotng/zyph-mobile/commit/48b8f8726518146736bffaf90975d740b7d7eacd))
* **layout:** add in-trip tab navigation ([#100](https://github.com/enzotng/zyph-mobile/issues/100)) ([0ec4dd0](https://github.com/enzotng/zyph-mobile/commit/0ec4dd093cf6a6d9519ecd184bfd46bf46d22952))
* **map:** plot POIs and live members alongside events ([#114](https://github.com/enzotng/zyph-mobile/issues/114)) ([9bdf4b7](https://github.com/enzotng/zyph-mobile/commit/9bdf4b7232aac6ed26a73868db8e6a248cb6b270))
* **offline:** persist the query cache and show an offline banner ([#118](https://github.com/enzotng/zyph-mobile/issues/118)) ([6059da5](https://github.com/enzotng/zyph-mobile/commit/6059da52d35fad02510697e685b05440a07d5582))
* **places:** add address autocomplete on the location picker ([#117](https://github.com/enzotng/zyph-mobile/issues/117)) ([d7ad3cb](https://github.com/enzotng/zyph-mobile/commit/d7ad3cbbb3dec58ca05a7020348540ef464e8c6d))
* **settlements:** add mark-as-paid payments netted into balances ([#111](https://github.com/enzotng/zyph-mobile/issues/111)) ([cd7dcda](https://github.com/enzotng/zyph-mobile/commit/cd7dcda52a367816bdf15f903138c1152dadff99))
* **smart-import:** reintegrate AI email-to-event import on the new app ([#110](https://github.com/enzotng/zyph-mobile/issues/110)) ([e03ada7](https://github.com/enzotng/zyph-mobile/commit/e03ada7c443c50dd0db16e1ebd3a5b2f49b01510)), closes [#94](https://github.com/enzotng/zyph-mobile/issues/94)
* **timeline:** add an event type picker and unify type icons ([#113](https://github.com/enzotng/zyph-mobile/issues/113)) ([131abba](https://github.com/enzotng/zyph-mobile/commit/131abbae20cc763128e6fffd9dcb9078b34c4a3d))
* **trips:** add optional travel dates to create and edit ([#112](https://github.com/enzotng/zyph-mobile/issues/112)) ([d222c55](https://github.com/enzotng/zyph-mobile/commit/d222c55a0d5b87490401a2fffeaec88eb43a3df1))
* **trips:** rebuild the expenses list (+ SDK 56 alignment) ([#105](https://github.com/enzotng/zyph-mobile/issues/105)) ([c292ce2](https://github.com/enzotng/zyph-mobile/commit/c292ce2ec377a6e591274888c0786e4fc3bf96ad))
* **trips:** rebuild the remaining screens to the prototype ([#107](https://github.com/enzotng/zyph-mobile/issues/107)) ([64451d3](https://github.com/enzotng/zyph-mobile/commit/64451d3ef69e186f7682772bad4f53eed6196476))
* **trips:** rebuild the trip overview as a dashboard ([#104](https://github.com/enzotng/zyph-mobile/issues/104)) ([8878c29](https://github.com/enzotng/zyph-mobile/commit/8878c29cfbd7971ad851f58176064cd8c76ec099))
* **trips:** rebuild the trips list as photo cards ([#103](https://github.com/enzotng/zyph-mobile/issues/103)) ([821957c](https://github.com/enzotng/zyph-mobile/commit/821957ce8f731a683e8b1fcaaf41f93463376d5b))
* **trips:** redesign the expense detail screen ([#106](https://github.com/enzotng/zyph-mobile/issues/106)) ([67b69dd](https://github.com/enzotng/zyph-mobile/commit/67b69dd4123a1601fbd0445d04812071358250a7))
* **ui:** add a floating tab bar for the global tabs ([8eb5ad0](https://github.com/enzotng/zyph-mobile/commit/8eb5ad04bcaa196e16d837f6d89678bdc862abdf))
* **ui:** add a global ErrorBoundary and ErrorState primitive ([#109](https://github.com/enzotng/zyph-mobile/issues/109)) ([5be032a](https://github.com/enzotng/zyph-mobile/commit/5be032a97565c04aef14ff17a321003978b464fa))
* **ui:** add design-system primitives with squircle surfaces ([33c2fd3](https://github.com/enzotng/zyph-mobile/commit/33c2fd3c81169ca883a22c704020a820f4e8d548))
* **ui:** animate and unify bottom sheets ([824ba00](https://github.com/enzotng/zyph-mobile/commit/824ba008f8af81b78e634839626c164fdeff6eb4))
* **ui:** apply squircle to all screen surfaces ([2be63fc](https://github.com/enzotng/zyph-mobile/commit/2be63fc2cf5e9874c56d871ecc6287b6ee41e72d))
* **ui:** apply squircle to expense and poi pickers ([99eb19a](https://github.com/enzotng/zyph-mobile/commit/99eb19a327e8d71463f1f14edeebf1701d690562))
* **ui:** load brand fonts and add CityImage primitive ([#101](https://github.com/enzotng/zyph-mobile/issues/101)) ([56cceea](https://github.com/enzotng/zyph-mobile/commit/56cceeafb33d51073d67c5d8ec82f486ac24a3b4))
* **ui:** migrate brand palette to indigo v2 tokens ([5c11323](https://github.com/enzotng/zyph-mobile/commit/5c11323f3f8a6ca5c122607ac0893719400f0485))
* **ui:** redesign home + trip dashboard (cover heroes, gradient cards) ([#120](https://github.com/enzotng/zyph-mobile/issues/120)) ([2f38550](https://github.com/enzotng/zyph-mobile/commit/2f385505dc5f4486ce423fe964f946ad5b2b8fcb))
* **ui:** sticky form footers, Zo redesign, trip-actions sheet ([#121](https://github.com/enzotng/zyph-mobile/issues/121)) ([8a5ca6e](https://github.com/enzotng/zyph-mobile/commit/8a5ca6e932e1ab819364f9372320c1e86b4f6bb1))

## 1.1.0 (2026-05-29)


### Features

* **api:** add supabase client with encrypted session storage ([f3452cd](https://github.com/enzotng/zyph-mobile/commit/f3452cd87d427129447772145e3c19ad52cd4c36))
* **api:** attach PDF documents to events (US-031) ([62872fa](https://github.com/enzotng/zyph-mobile/commit/62872fa4d6fbf3ce2e644e061b8fab688c7556bd))
* **api:** copy and regenerate trip invite code (US-019) ([8a0a383](https://github.com/enzotng/zyph-mobile/commit/8a0a383d068e9a6ab7336f9f9ee3e1da6614c173))
* **api:** custom expense splits by member and weight (US-032) ([174e83f](https://github.com/enzotng/zyph-mobile/commit/174e83fae7fb5e96b33f00ea045ee386bbeec146))
* **api:** event countdown and status (US-021) ([2806ac6](https://github.com/enzotng/zyph-mobile/commit/2806ac6b7e3fa26bb147daf055337818ba2b2c64))
* **api:** multi-currency expenses via ECB rates (US-025) ([36ea4fc](https://github.com/enzotng/zyph-mobile/commit/36ea4fc2c0d8f172bdb64ba8b5db863ad65f6652))
* **auth:** email/password auth slice (signup, login, logout, guards) ([146c5e2](https://github.com/enzotng/zyph-mobile/commit/146c5e24e5eeae6ab468813a72df0c9775a586b0))
* **db:** initial schema (trips, members, timeline, expenses, media) ([37664ce](https://github.com/enzotng/zyph-mobile/commit/37664ce88e9e3bb533daa2c0853ad399e668bc3d))
* **events:** edit and delete events ([6d9b208](https://github.com/enzotng/zyph-mobile/commit/6d9b2085e6d440d261feb8a41dd90f41895f0314))
* **expenses:** add & view trip expenses with equal split (US-017/018) ([fcec8b7](https://github.com/enzotng/zyph-mobile/commit/fcec8b741278af66a33991e8ab17876c29050dd7))
* **expenses:** add receipt OCR scanner ([bebd143](https://github.com/enzotng/zyph-mobile/commit/bebd14385d55a5f7623bc434033f9ecd8bb81b82))
* **expenses:** edit and delete expenses with detail view ([d26d14a](https://github.com/enzotng/zyph-mobile/commit/d26d14a132be31059c38626dee8595405bfd88a5))
* **expenses:** per-member trip balances (US-024) ([a95672b](https://github.com/enzotng/zyph-mobile/commit/a95672bf4d36557c55bcd1b58c7e06f63dab1654))
* **expenses:** search and filter expenses on trip detail ([d8fcbc0](https://github.com/enzotng/zyph-mobile/commit/d8fcbc02132ea478ed1ca55a8b6f63b59c7cbdc5))
* **expenses:** smart split attribution screen and OCR flow ([892c820](https://github.com/enzotng/zyph-mobile/commit/892c82088881502fc8918120d54e95f4ff95ca9c))
* **expenses:** smart split data layer with per-item attribution ([3171ca4](https://github.com/enzotng/zyph-mobile/commit/3171ca4ede75d79f748c39df827daac03a14c3a3))
* **expenses:** tag expenses with a category ([f5bcaf8](https://github.com/enzotng/zyph-mobile/commit/f5bcaf8243cb18f857c6e037dd44056346f68cfd))
* **expenses:** view per-item breakdown and re-edit Smart Split attribution ([3c82545](https://github.com/enzotng/zyph-mobile/commit/3c825452f528d6923b3087c2078e287f27498e62))
* **group:** join trips by code + member visibility (US-019/020/026) ([76fc652](https://github.com/enzotng/zyph-mobile/commit/76fc652aa651beb74f9050ce91cce3f09bcee50a))
* **group:** leave trip and remove member ([d9a0f54](https://github.com/enzotng/zyph-mobile/commit/d9a0f541f796dd4ce0f83d119a610504dab0039b))
* **layout:** shared app header and screen wrapper (US-042) ([609eb79](https://github.com/enzotng/zyph-mobile/commit/609eb790463a498d128304e492a83ffb683d6dbb))
* **profile:** edit display name and preferred currency ([3d47a53](https://github.com/enzotng/zyph-mobile/commit/3d47a532354574c60c3676058f7def6d587be3af))
* **timeline:** trip timeline + manual events (US-014/015) ([70be753](https://github.com/enzotng/zyph-mobile/commit/70be75337704e83d9edff24a8bd2c23bb08c25aa))
* **trips:** edit & delete trips, owner-gated (US-013/027) ([52e491b](https://github.com/enzotng/zyph-mobile/commit/52e491b9688290211907302fe524adf446ba0609))
* **trips:** trips CRUD - list, create, detail (US-010..012) ([070ffdc](https://github.com/enzotng/zyph-mobile/commit/070ffdc6ad39fd8a51dc2232d9d78bc39925a271))
* **ui:** add interactive trip map with event locations (US-030) ([a6cb8e7](https://github.com/enzotng/zyph-mobile/commit/a6cb8e76d0407c2f6867d61ac6047bcfedbb3750))
* **ui:** bottom-tab navigation - Trips + Profile (US-041) ([bf12cdc](https://github.com/enzotng/zyph-mobile/commit/bf12cdc46ba721043d95b7820dbacac4b910921d))
* **ui:** dark mode preference toggle (US-035) ([9df5de7](https://github.com/enzotng/zyph-mobile/commit/9df5de7505fa82864db563d4895ef7bbde58cb9c))
* **ui:** first-launch onboarding (US-040) ([489b293](https://github.com/enzotng/zyph-mobile/commit/489b293d3f97bfed3a61bea1e8d089302221d5e2))
* **ui:** native compact iOS date picker with time selection ([6f85fb3](https://github.com/enzotng/zyph-mobile/commit/6f85fb34934f31603b99e28fefa14e86500ec61e))
* **ui:** replace expo demo template with unistyles 3 design system ([7dac2c9](https://github.com/enzotng/zyph-mobile/commit/7dac2c92b892ad3ad1570bb17ccc4cc2007175d5))
* **ui:** show settlement plan and polish members list (US-024, US-026) ([9647859](https://github.com/enzotng/zyph-mobile/commit/964785973dfc3898959f7498f6878d01364a2919))
* **wayfinder:** add POI CRUD, gate location and live location sharing ([a01f82d](https://github.com/enzotng/zyph-mobile/commit/a01f82d5a83e3c7c73d6ae64d1bc42c2a7f41350))
* **wayfinder:** AR camera screen with markers, arrow and sensors ([273394f](https://github.com/enzotng/zyph-mobile/commit/273394f173515a3e82f966ec50dba108a467d79c))
* **wayfinder:** scaffold AR wayfinder foundations ([512ff41](https://github.com/enzotng/zyph-mobile/commit/512ff41500d742d0eb70d6cc45f9fbd3f289a204))


### Bug Fixes

* **api:** derive split state without setState in effect ([da5975c](https://github.com/enzotng/zyph-mobile/commit/da5975c7da73e74ce3713cd5580fd78e91f48658))
* **group:** keep removed members on the books and allow re-joining ([a6a56c8](https://github.com/enzotng/zyph-mobile/commit/a6a56c834af729470c97f1139e83e799216aca94))
* **ui:** handle loading/error states and guard route edge cases ([3442c99](https://github.com/enzotng/zyph-mobile/commit/3442c99efca5fb3b0d9f85372a2c297913d843dc))
* **ui:** rename location helper to satisfy rules-of-hooks lint ([c77ad48](https://github.com/enzotng/zyph-mobile/commit/c77ad48e2e2a50b1f7b6bb44f6f78863a524f98f))
