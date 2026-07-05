# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [1.6.1](https://github.com/enzotng/zyph-mobile/compare/v1.6.0...v1.6.1) (2026-07-05)

## [1.6.0](https://github.com/enzotng/zyph-mobile/compare/v1.5.0...v1.6.0) (2026-07-03)

## [1.5.0](https://github.com/enzotng/zyph-mobile/compare/v1.4.1...v1.5.0) (2026-06-24)

## [1.4.1](https://github.com/enzotng/zyph-mobile/compare/v1.4.0...v1.4.1) (2026-06-21)


### Bug Fixes

* **smart-import:** move native-intent redirect to lib so its test is not scanned as a route ([b7df930](https://github.com/enzotng/zyph-mobile/commit/b7df9306d04c6594a0f112ca8463988a9ae6e744))

## [1.4.0](https://github.com/enzotng/zyph-mobile/compare/v1.3.1...v1.4.0) (2026-06-20)


### Features

* **smart-import:** add OS share-sheet entry point for bookings ([#208](https://github.com/enzotng/zyph-mobile/issues/208)) ([#209](https://github.com/enzotng/zyph-mobile/issues/209)) ([fa537db](https://github.com/enzotng/zyph-mobile/commit/fa537db66ca77ffb603cd615393825df993b91c0))

## [1.3.1](https://github.com/enzotng/zyph-mobile/compare/v1.3.0...v1.3.1) (2026-06-16)


### Features

* **api:** rate-limit the paid-API edge functions ([#152](https://github.com/enzotng/zyph-mobile/issues/152)) ([8f3cec1](https://github.com/enzotng/zyph-mobile/commit/8f3cec129e2aebec9b5729e2b1c65062097f5661))
* **api:** trip cover from Google Places with Unsplash fallback ([#191](https://github.com/enzotng/zyph-mobile/issues/191)) ([8c74c10](https://github.com/enzotng/zyph-mobile/commit/8c74c1059f2a7636aee748357b7a1833778fd422))
* **auth:** add in-app change password ([#153](https://github.com/enzotng/zyph-mobile/issues/153)) ([685dc25](https://github.com/enzotng/zyph-mobile/commit/685dc2545c221f79398cc121509cf17ec9dbdabd))
* **auth:** add native Sign in with Apple ([#157](https://github.com/enzotng/zyph-mobile/issues/157)) ([a4abb04](https://github.com/enzotng/zyph-mobile/commit/a4abb0404fa8b47b76e55df58a69773daff147fa))
* **copilot:** richer context, persistent history, inline widgets ([#156](https://github.com/enzotng/zyph-mobile/issues/156)) ([520d5a5](https://github.com/enzotng/zyph-mobile/commit/520d5a590e2933ad672788d96a730d57245debd7))
* **expenses:** add "Paid by" selector for shared expenses ([#166](https://github.com/enzotng/zyph-mobile/issues/166)) ([63b14e4](https://github.com/enzotng/zyph-mobile/commit/63b14e453a8f6dae0afbd0e79b37d29822d50e14))
* **expenses:** add manual per-item split entry ([#174](https://github.com/enzotng/zyph-mobile/issues/174)) ([6e6ee17](https://github.com/enzotng/zyph-mobile/commit/6e6ee1726d8073addf4e548fbc1d6253ecfb6910))
* **expenses:** add split modes (equal/shares/exact/percent) + remainder banner ([#167](https://github.com/enzotng/zyph-mobile/issues/167)) ([1a198b5](https://github.com/enzotng/zyph-mobile/commit/1a198b54070edf17945436d8d425137630126629))
* **expenses:** atomic Smart Split create via single RPC ([#171](https://github.com/enzotng/zyph-mobile/issues/171)) ([367e57c](https://github.com/enzotng/zyph-mobile/commit/367e57cda56700932922f901848a2266479eb4b0))
* **expenses:** export trip expenses to CSV ([#188](https://github.com/enzotng/zyph-mobile/issues/188)) ([ee66a95](https://github.com/enzotng/zyph-mobile/commit/ee66a952635df7df1f5294d4b049608db33e936b))
* **expenses:** flatten add/edit expense to a dense Tricount-style form ([#185](https://github.com/enzotng/zyph-mobile/issues/185)) ([36ba31d](https://github.com/enzotng/zyph-mobile/commit/36ba31d6eb1592d99a100dffd86f506d1dc9e163))
* **expenses:** multi-payer backend (expense_payers + balances) ([#175](https://github.com/enzotng/zyph-mobile/issues/175)) ([77d4394](https://github.com/enzotng/zyph-mobile/commit/77d43941e09a9a21818ac202e81b16fa3c85afaa))
* **expenses:** multi-payer UI (paid by one or several) ([#176](https://github.com/enzotng/zyph-mobile/issues/176)) ([9572aee](https://github.com/enzotng/zyph-mobile/commit/9572aee857162079fe6b18e3d2e281431dae32e8))
* **expenses:** paid-by and category as compact 2-column selects ([#186](https://github.com/enzotng/zyph-mobile/issues/186)) ([8c7a689](https://github.com/enzotng/zyph-mobile/commit/8c7a6893f21278835faf52741be7a8cdd9d31cf1))
* **expenses:** redesign payer & split controls (vertical rows + sheet) ([#177](https://github.com/enzotng/zyph-mobile/issues/177)) ([d1f1ea4](https://github.com/enzotng/zyph-mobile/commit/d1f1ea407d280d91d2047b529aeaa7bf2a10faa2))
* **expenses:** restructure add/edit expense into sections ([#178](https://github.com/enzotng/zyph-mobile/issues/178)) ([8298441](https://github.com/enzotng/zyph-mobile/commit/8298441105e3fa94ab20ccc9abdef163698a0e96))
* **expenses:** show frozen fx rate on foreign expense detail ([#172](https://github.com/enzotng/zyph-mobile/issues/172)) ([b82be93](https://github.com/enzotng/zyph-mobile/commit/b82be938e4f393145a16d8e02511d47b0133ac04))
* **expenses:** Smart Split bulk-assign and tinted member avatars ([#182](https://github.com/enzotng/zyph-mobile/issues/182)) ([bf1b74d](https://github.com/enzotng/zyph-mobile/commit/bf1b74d89128efa198bdb65ee7f3df24725e13cf))
* **group:** invite deep link with auto-join and enriched share ([#187](https://github.com/enzotng/zyph-mobile/issues/187)) ([1792f55](https://github.com/enzotng/zyph-mobile/commit/1792f55209053322ff6ed1dd6ea6d821f274b46e))
* **i18n:** localize group dialogs, share-location copy and labels ([#148](https://github.com/enzotng/zyph-mobile/issues/148)) ([2158d81](https://github.com/enzotng/zyph-mobile/commit/2158d81bdd0836b2bf48bafeceb53e036ebe83e6))
* **map:** redesign trip map with app-bar, layers sheet and action cluster ([#162](https://github.com/enzotng/zyph-mobile/issues/162)) ([34c0638](https://github.com/enzotng/zyph-mobile/commit/34c06388b95bcd7eed8026faffb89075c2a5e458))
* **notifications:** add real push notifications via Expo and pg_net ([#144](https://github.com/enzotng/zyph-mobile/issues/144)) ([0aeeda3](https://github.com/enzotng/zyph-mobile/commit/0aeeda3d23bd2e85c4130f00d659ad5368b4b8bf))
* **notifications:** localize push copy and deep-link on tap ([#146](https://github.com/enzotng/zyph-mobile/issues/146)) ([253ccaf](https://github.com/enzotng/zyph-mobile/commit/253ccaf36d23f6b64866aa42c159042858410081))
* **profile:** add avatar upload and co-member avatars ([#149](https://github.com/enzotng/zyph-mobile/issues/149)) ([b4bf80f](https://github.com/enzotng/zyph-mobile/commit/b4bf80f90400613c8bb5f21e1c050b657e2d2e0c))
* **profile:** add RGPD account deletion ([#155](https://github.com/enzotng/zyph-mobile/issues/155)) ([5444a70](https://github.com/enzotng/zyph-mobile/commit/5444a7076fc85f38c736d6d3afe0ead19105a227))
* **profile:** in-app legal link + buildNumber bump ([#159](https://github.com/enzotng/zyph-mobile/issues/159)) ([242f518](https://github.com/enzotng/zyph-mobile/commit/242f518eccbfff27bfac3dfab7af496a13ff58a4))
* **settings:** add language switcher with native per-app locale ([#147](https://github.com/enzotng/zyph-mobile/issues/147)) ([d488841](https://github.com/enzotng/zyph-mobile/commit/d4888418ab36be737806a89e2ab9e721caeec2d1))
* **smart-import:** confidence meter and editable fields before import ([#189](https://github.com/enzotng/zyph-mobile/issues/189)) ([276eed5](https://github.com/enzotng/zyph-mobile/commit/276eed55ff4d9bd3a8bd92debcad40f844f62662))
* **timeline:** open event documents in an in-app browser sheet ([#151](https://github.com/enzotng/zyph-mobile/issues/151)) ([c695bc5](https://github.com/enzotng/zyph-mobile/commit/c695bc5730fbf38ea46f1d00b0ec90728b4922d2))
* **trips:** dedicated balances & settle-up screen with pairwise breakdown ([#169](https://github.com/enzotng/zyph-mobile/issues/169)) ([dfc6a32](https://github.com/enzotng/zyph-mobile/commit/dfc6a323de6ccbef2a04e7b697d8dcecad238c8a))
* **trips:** let the owner upload a custom trip cover ([#192](https://github.com/enzotng/zyph-mobile/issues/192)) ([3daf946](https://github.com/enzotng/zyph-mobile/commit/3daf9462d788cc0b00710eb2776e9eb1bd2b0118))
* **trips:** resolve removed-member names in balances & splits ([#170](https://github.com/enzotng/zyph-mobile/issues/170)) ([db35106](https://github.com/enzotng/zyph-mobile/commit/db3510686cf9bc0b081934a5f4972134d66ba959))
* **trips:** share settle-up plan and settle all my debts ([#173](https://github.com/enzotng/zyph-mobile/issues/173)) ([f738709](https://github.com/enzotng/zyph-mobile/commit/f738709d9718fe984d6fdb8f75f9110e241a0cee))
* **trips:** show your share per expense in the feed ([#180](https://github.com/enzotng/zyph-mobile/issues/180)) ([d9141d3](https://github.com/enzotng/zyph-mobile/commit/d9141d3cae3ed777ed37338183bac05ab26d01ff))
* **trips:** trip-level documents hub ([#161](https://github.com/enzotng/zyph-mobile/issues/161)) ([e729552](https://github.com/enzotng/zyph-mobile/commit/e72955242e8cf56d2bbe829f535eb546b9e6b200))
* **trips:** your-position hero on balances + dedup transfers ([#181](https://github.com/enzotng/zyph-mobile/issues/181)) ([a2882ba](https://github.com/enzotng/zyph-mobile/commit/a2882ba6b0ca884d7bf7a91ff462cc42d82954a8))
* **ui:** add a create/join trip entry point to the dashboard ([#204](https://github.com/enzotng/zyph-mobile/issues/204)) ([9c9f86e](https://github.com/enzotng/zyph-mobile/commit/9c9f86eadd77e6ec500dfc03ea6460f4def72f90))
* **ui:** add haptic feedback to selection controls ([#199](https://github.com/enzotng/zyph-mobile/issues/199)) ([b145e00](https://github.com/enzotng/zyph-mobile/commit/b145e00c48695fc3ad6b386cd3de06cdb032683d))
* **ui:** adopt real ZYPH logo and indigo brand assets ([#163](https://github.com/enzotng/zyph-mobile/issues/163)) ([67e9d7c](https://github.com/enzotng/zyph-mobile/commit/67e9d7ce63b39981cede974c60c4c1e99007df93))
* **ui:** currency picker with flag + localized name ([#168](https://github.com/enzotng/zyph-mobile/issues/168)) ([42ad1f2](https://github.com/enzotng/zyph-mobile/commit/42ad1f22347981c254261baf20f3b9635717fbb3))
* **wayfinder:** haptic wayfinding feedback in AR ([#190](https://github.com/enzotng/zyph-mobile/issues/190)) ([f8dc34e](https://github.com/enzotng/zyph-mobile/commit/f8dc34e45aed2531f118eb41c7ef5afe76b42cb6))
* **wayfinder:** premium AR overlay - Skia arrow, POI cards, path ([#160](https://github.com/enzotng/zyph-mobile/issues/160)) ([f16b6f2](https://github.com/enzotng/zyph-mobile/commit/f16b6f202805160ebc1fba052309e9ef73c61a5f))


### Bug Fixes

* **a11y:** add missing accessibility labels and hit targets ([#195](https://github.com/enzotng/zyph-mobile/issues/195)) ([6a62f8d](https://github.com/enzotng/zyph-mobile/commit/6a62f8d48ce4bfc058bdb0362a84bf8957997b52))
* **api:** pin trip_events creator and rate-limit upload functions ([#194](https://github.com/enzotng/zyph-mobile/issues/194)) ([ebdb9a4](https://github.com/enzotng/zyph-mobile/commit/ebdb9a4669b9c1c670a12dadd177f4daebdb0659))
* **api:** use largest-remainder split on itemised expense edit ([#202](https://github.com/enzotng/zyph-mobile/issues/202)) ([81da0a2](https://github.com/enzotng/zyph-mobile/commit/81da0a29ed674d9c12427982714d60ffa9bd7d51))
* **app:** resolve confirmed bugs from the adversarial audit ([#193](https://github.com/enzotng/zyph-mobile/issues/193)) ([f2f2410](https://github.com/enzotng/zyph-mobile/commit/f2f24108df4ca1eb49aea6197ddef9868bc996bf))
* **auth:** normalize display name at signup ([#184](https://github.com/enzotng/zyph-mobile/issues/184)) ([4081291](https://github.com/enzotng/zyph-mobile/commit/4081291c07386e774bca27991031e26445021650))
* **auth:** preserve invite deep-link across sign-in for new users ([#203](https://github.com/enzotng/zyph-mobile/issues/203)) ([28e148a](https://github.com/enzotng/zyph-mobile/commit/28e148a692a126264fcdd74276a83e8f6b3b595b))
* **expenses:** collapse duplicate update_expense_with_splits overload ([#164](https://github.com/enzotng/zyph-mobile/issues/164)) ([db4f07e](https://github.com/enzotng/zyph-mobile/commit/db4f07e2ff080c014ac85ac7892f6fab5b2c1261))
* **expenses:** preserve custom splits on edit, extract useSplitEditor ([#165](https://github.com/enzotng/zyph-mobile/issues/165)) ([fd73d61](https://github.com/enzotng/zyph-mobile/commit/fd73d61cba738206ea0441b07f130e57a39b9c09))
* **profile:** upload avatar via edge function (ES256 storage RLS) ([#150](https://github.com/enzotng/zyph-mobile/issues/150)) ([43977c9](https://github.com/enzotng/zyph-mobile/commit/43977c929530e989b9af673701c5f6db127b54d8))
* **ui:** audit quick-wins for cache, forms, i18n and lifecycle ([#200](https://github.com/enzotng/zyph-mobile/issues/200)) ([63ac099](https://github.com/enzotng/zyph-mobile/commit/63ac0995fd6657f7ae918029045f22b776e3f505))
* **ui:** audit robustness - sensor leaks, offline sign-out, copilot state ([#201](https://github.com/enzotng/zyph-mobile/issues/201)) ([da4c74e](https://github.com/enzotng/zyph-mobile/commit/da4c74e3f357c2b3ab8fc9bdec86a0aab88569ae))
* **ui:** consistent error states and pull-to-refresh on trip lists ([#198](https://github.com/enzotng/zyph-mobile/issues/198)) ([3e114dc](https://github.com/enzotng/zyph-mobile/commit/3e114dc8fcb712160ce6be5133bb32dd6518929b))
* **ui:** guard layouts against long names and counts ([#197](https://github.com/enzotng/zyph-mobile/issues/197)) ([893aec2](https://github.com/enzotng/zyph-mobile/commit/893aec2850e263b3ee25698e144aa065c507694a))
* **ui:** make notifications mark-all-read a single icon button ([#183](https://github.com/enzotng/zyph-mobile/issues/183)) ([b78b463](https://github.com/enzotng/zyph-mobile/commit/b78b463c48955c53315b08c7aca179ef201c3c04))
* **ui:** unify the create/join CTA treatment across states ([#205](https://github.com/enzotng/zyph-mobile/issues/205)) ([63a5c7d](https://github.com/enzotng/zyph-mobile/commit/63a5c7dced803e7f98bcb780b4e84162a9494921))

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
