# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

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
