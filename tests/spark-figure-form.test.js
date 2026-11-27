/*
 * Spark figure form — every seed draws ONE figure (pass 8b).
 *
 * Aaron's phone, Nov 26, 2026, 20:36 PST: the Spark Kan, standing
 * in the Sphere page's demonstration panel, rendered as a doubled,
 * mirrored tan blob with a drip between — not a figure. Pymior, in
 * the same panel days before, rendered clean. The difference was
 * the seed's form. Rendered across a 64-seed spread (every kind x
 * every form, plus Selor's own seed and two Kan candidates), five
 * forms drew one figure at every stage; the moth alone drew two:
 * in bodyShape its wings (rx 17 at cx 28/72) were the widest masses
 * on the page and its body (rx 11) the pinch between them, so the
 * silhouette read as a mirrored pair.
 *
 * The fix is one case of bodyShape: the moth's wings now sweep up
 * from behind the shoulders, narrower than the body (rx 12.5
 * against the body's 14.5), sunk deep into it. Nothing else in the
 * drawing moved — and this file pins that, byte for byte: every
 * non-moth seed in the spread must render EXACTLY the string it
 * rendered before the fix (born and grown), Selor among them, and
 * every moth seed must render a different one. A future change
 * that moves a good Spark's face fails here, on purpose.
 *
 * The structural pins state the law the moth broke, for every
 * form: the body's own shapes (the primitives filled with the
 * body's colour) form a single connected union, and the largest
 * of them carries the eye. A form whose widest mass hangs off to
 * one side — two lobes and a pinch — fails.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");

const Core = require(path.join(__dirname, "..", "docs/assets/js/spark-companion.js"));

const ALL_REVEALED = ["trail", "pattern", "ears", "cheeks", "crest"];
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

/* The spread: every kind x every form, Selor's own seed, two Kan
 * candidates (a Kan who is a moth is the screenshot's Spark, up to
 * the nonce), and a random fill. born/grown are the SHA-256 of the
 * figure as it rendered BEFORE the moth fix. */
const SPREAD = [
  { seed: "spark1-3-3-0-apeeb220", name: "Solri", kind: "fire", form: "orb", born: "3088180cd86f693b1606cf8f4623af8f5d84dfecf8c21b5d9d178ceb56c33778", grown: "7fc5e88f268b71e964242b2048fa8a426dcc5dbe0faf6bb8d93da7b332d69cbc" },
  { seed: "spark1-8-8-0-hgfw3870", name: "Solra", kind: "fire", form: "comet", born: "f2f5c54a6d4b68ca81c03a2068f98c6ad1fbe7967d81adb6a79ad22184a48365", grown: "de2a7f809dd555b6e84d6b9f782eff725ad099f9d7cd8f891d96540f350be986" },
  { seed: "spark1-1-1-0-00000000", name: "Soln", kind: "fire", form: "sprout", born: "17298429c66ac7f8a59ea0e101c540e6c44248f3da66ca1c43eaad44a80a1cd8", grown: "eae14b59d10027a4170f9413eac6ee9c722176c3b2508cbe5a652e179cdadb5b" },
  { seed: "spark1-4-4-0-x1m3h330", name: "Kan", kind: "fire", form: "shard", born: "b9790a826e8bb7c80e8767b523efcbad7cd696ef772fea88214d6617029837e9", grown: "13528041413886a93c837d2e2007dbb2dd7ee700ba265b4c24b7a30e5e179921" },
  { seed: "spark1-3-16-0-l92idhf0", name: "Solith", kind: "fire", form: "wave", born: "c810c59454959ff5261b3683be4529d63f29732128fbfc82c604b283b6d2e36f", grown: "30854804a3076e84769dacd934646a26e371a2a56c75e25a7d925e6d61145608" },
  { seed: "spark1-2-2-0-nc7p5110", name: "Emiri", kind: "fire", form: "moth", born: "cf39b79653b60572a2869f46c657da7ebb52d250a94b9eaa18a3692297d91ca6", grown: "c81d3bcec786980fe206b237b5e5fce9ffa80106e8382951a603a75aead62da2" },
  { seed: "spark1-7-20-1-yy5z1q60", name: "Onra", kind: "water", form: "orb", born: "5120663c60e6846dc4d83f70ebf61a0a751e03e39cd4184abb3158cdc35b7ee6", grown: "48a4729a47533cd9b60c4ba3ce626e026da4db61dd86c896ab0f10a1c7ed6283" },
  { seed: "spark1-1-1-1-taao14n0", name: "Miri", kind: "water", form: "comet", born: "1a7eeaa43af3fd3fbe68d4156a210248c7c61374c0251bd5d402f3725adb3535", grown: "c4ee77739cb7a547af41d107d7a90a14abacb4839128b097f1453b0001b5d2a8" },
  { seed: "spark1-2-2-1-gnhd75o0", name: "Onemi", kind: "water", form: "sprout", born: "e85e7315c2f654d97bb420dfbcbf422f0651327f717a60abd3afb1755ae619a2", grown: "d1a345631078fb3ee2d095517d092bd24bbe7c2fca685422d842ea58e038cacf" },
  { seed: "spark1-8-21-1-lbdo7r70", name: "Lueri", kind: "water", form: "shard", born: "68ce991b7275c0805bfdfc77829005bfa080158c8f34737ff8dbc6222c1743ee", grown: "0ee2645283417b278cbe3c6d664a25668c2c518561ed74fb2fc3223c098e183f" },
  { seed: "spark1-6-6-1-02b6u9s0", name: "Milika", kind: "water", form: "wave", born: "5893fab98f24b6ca28145b22c52ab02ed5945dbfc0b3d369199796ffde4b0874", grown: "fcfa3b5d35c55c1ca7da3501497de3eb5f2a8b9519aa7e344f65c33f199a7485" },
  { seed: "spark1-3-3-1-30p2d6p0", name: "Naka", kind: "water", form: "moth", born: "46cfb75247eaa81b20ff5950ed9ce5282fb1b056c72ff28b04ae9c851f7b0b29", grown: "70a68e9cf638ce39efffd6c761ccbf4c0936555eaef8746f5c0fb8776a695236" },
  { seed: "spark1-11-11-2-04mcojk0", name: "Lora", kind: "shadow", form: "orb", born: "19004bc144ada6dc96c58736dfc24696c87d0b0f5824d1163131178704144c9b", grown: "a49dea5d92fb79e3843244f6652d643bcf6c2ad4eb9f551c3e09fb85e1ae2b6d" },
  { seed: "spark1-2-2-2-9yr199b0", name: "Noan", kind: "shadow", form: "comet", born: "9b0c7a56ca7fa3ef88f9980f48eb1f2861241b5d3c00e7066b130d057f1a6ced", grown: "60018336ce74607b892e33758b1d89f5753aa20c7980f83021476dc1de3c9aaa" },
  { seed: "spark1-9-9-2-qe7ychi0", name: "Noth", kind: "shadow", form: "sprout", born: "0d7f5dd9b9fcee1483d3c266004b25a18433d5049b5efe39308b4682d0989825", grown: "3d6f736caf501368246ccb28d96940f5b99f78d2b7e641cb3a2c5573c505c55d" },
  { seed: "spark1-1-1-2-mlkc38a0", name: "Umiri", kind: "shadow", form: "shard", born: "6694247d98faa2d42669099114f9bd685b61caed772de3bc9662036c233d6f49", grown: "babebdaa68a2bddb673d660e9ad9c2b094c17cc96705b70243d924deb6dee7dd" },
  { seed: "spark1-3-3-2-wazqeac0", name: "Seven", kind: "shadow", form: "wave", born: "c4f18de8fcee4c9d1fc91a6b72fd2df094647e819adf6062a06d72b25169fa6c", grown: "8085a34aa325cf5fa6ed03a33155be9a697e622ccb379c3e698366d71224e48a" },
  { seed: "spark1-6-6-2-tcluvdf0", name: "Nomim", kind: "shadow", form: "moth", born: "46daffc00214edbc10e8b051c3271e9dfcc2e08130e5f617a473929d55380e3f", grown: "989994e8b15f7b942a7ab4ce5c90e9e1af473e63bb9bc118a2d87097df19c9aa" },
  { seed: "spark1-4-4-3-cyg4mf00", name: "Sioor", kind: "air", form: "orb", born: "80404f989034dc8417b596723a49e721b7214b1e1697db18299afed2a37b3c74", grown: "ab520a56b26b790196e31ebac9f1fb8a85c215b3ca67e24b02ed00f60ba95824" },
  { seed: "spark1-3-3-3-pl9fgez0", name: "Zelim", kind: "air", form: "comet", born: "544fa283cb0c0275cfef716b06985f572c709f17b195afab916f099a14d22172", grown: "38f94cd74c05b4f82f820d0748d3de229f5577dab76c1db31633e89d66d01c6b" },
  { seed: "spark1-1-1-3-fwu05cx0", name: "Zemiri", kind: "air", form: "sprout", born: "ac7153a9c0109a311d53eb0f125d198e061b632a542a3a378d31e05b87918f1a", grown: "57ad759907692e4d179212446dd9eab1902e3ffdcd35d5841f38a3947f89cbfc" },
  { seed: "spark1-5-18-3-avbxtve0", name: "Oriven", kind: "air", form: "shard", born: "3ba0521b989fa814e04384f0582b4c7f1a1de6c5be9c5b3082224aa49031af0c", grown: "2b160a64c3c21b38567843b6fd6540d40d9c2cf775e5fc61947cfb3dcafe2a73" },
  { seed: "spark1-8-8-3-wcax8k40", name: "Siliri", kind: "air", form: "wave", born: "6fe4070427a9bd4cabb2c37dd13122e265766c29d465ee4bb8a6b0c39f3e334b", grown: "c28897a773412017e8b1057a2e365f84e6d39aa55cfe5bc476dc33c6add7d7b2" },
  { seed: "spark1-2-2-3-292qady0", name: "Wieth", kind: "air", form: "moth", born: "06ba4b1218163861f6fd88ce421400d6795d601db2c80d78ac27ac8aed344aa9", grown: "af5436b8ca8afe15af11530075b2c64e31320a01b4df8fa2cdd1cc94d0b4733d" },
  { seed: "spark1-7-7-4-2bdw4nq0", name: "Rori", kind: "earth", form: "orb", born: "1edb6a743224fa8fb1decb8780f55f228883659607e1e81bcb1f23084c905bb3", grown: "ac776ea9da9ac49ae5a5feecc9358987e39c598ccde35a61138a4b11cdb40cc2" },
  { seed: "spark1-4-4-4-59rsnjn0", name: "Dum", kind: "earth", form: "comet", born: "e87e0f578543aa78a8b3f41130e405f4fa5b1f707a197d872b3af6507b642d3b", grown: "eca7c724d5473345adebd1e5695ec45cbf87cfe1dfa48cef9b40aa410ea4e911" },
  { seed: "spark1-1-1-4-875p6gk0", name: "Man", kind: "earth", form: "sprout", born: "31efdb4ea32c9bedc7c8ad93201fd25610fc2f2ad629fffddcf20d92b4b3b88a", grown: "4cf9889f41f0b0d2531d9a750c4bbc9654aaa86c88e8f8dde1c0360306dd5cf6" },
  { seed: "spark1-3-3-4-iwj3iim0", name: "Gaael", kind: "earth", form: "shard", born: "d4bf97f2731102e223ead8fb0dbd7118ff78c4cf626c5ab103459a83694a817c", grown: "96ca9dc8d4ec0a14311601687b5fdb516c9fca425bd7afe310a6dbc90a6469d2" },
  { seed: "spark1-9-9-4-c0sagps0", name: "Gaosha", kind: "earth", form: "wave", born: "262c1cb600173940271414bdcfe9b96c975a6c2e936fd8744b0a71b09abcf079", grown: "e909586821f9ee0191409cd924bf8e8623277b469ba41d032f47348393760065" },
  { seed: "spark1-6-6-4-fy57zlp0", name: "Ananor", kind: "earth", form: "moth", born: "a8dc55b47b077ad596d39adb94af5fb19845b861e2df232281f931b7a1133a75", grown: "7b7a6066ffa96bdf0c741382e7c3fa12d53ee54ef2b27f7a25579d2bcead6c17" },
  { seed: "spark1-9-9-5-4b2zhtf0", name: "Luven", kind: "light", form: "orb", born: "9bffbf4033d0863d5a8cf2b69851930d7ab4c2c6d9ae4034371b5c40f446db2a", grown: "69183d600c0f362c711e62b59d9baa7907c22226ac359df4197c80a2f195ca4d" },
  { seed: "spark1-8-8-5-iyu9cse0", name: "Soanm", kind: "light", form: "comet", born: "439d307ee1c28ec04c2530dad92baa73e4f093b928edff3f14b758fc51183ea8", grown: "69d278e66d89bde323d010e8b6e4fcec945c0600449557b2ea86aae603615a80" },
  { seed: "spark1-6-19-5-kt3z25q0", name: "Soaor", kind: "light", form: "sprout", born: "16fcb7b81be6dab21ac38954e0547bbd54240e1beef59e6d6bf1476b719ea842", grown: "f1371949d2867b6609c4abe038b8a835c91757f85e3bc3bf1e3d310ae8a3caad" },
  { seed: "spark1-1-1-5-0ifd8k70", name: "Nomisha", kind: "light", form: "shard", born: "aa6b834af9c4f9f1adba5cc296216878420feea1df48aebd92831bab3d80afb3", grown: "bc5a809b5a66ca46fe3105e90b3ffc82f49e2fb07497de2d740a6ab923a4af25" },
  { seed: "spark1-3-3-5-c7urjm90", name: "Eliaven", kind: "light", form: "wave", born: "ae2a3f2864619358ea36c8d729364e1e8ef1855d8cfd9ec58c5fbd9bae53ba97", grown: "43f9c18bb2ccb63a61543590f77172b4a1dd2f1a5f642833c7fa5e16daaccf73" },
  { seed: "spark1-2-2-5-oum2el80", name: "Soka", kind: "light", form: "moth", born: "df1de2db6f68130b15266dbbd5519dfe0a2665fcdd71caf3b12138f480199a0b", grown: "724a3ee696dd4ca920ad9e24eed61314c37f1d4bf71c8be7fcd9bd0bf75f7821" },
  { seed: "spark1-9-225-0-l9dbe300", name: "Kan", kind: "fire", form: "moth", born: "4073658701b47d3075d5b3be943af62f381dd4a6d49faf1e6139c56a4ddf3059", grown: "ee75e4170b09d316854106ee375f760f37cf83fbce02a30325a959bba90a6b08" },
  { seed: "spark1-9-225-0-0y0m3400", name: "Kan", kind: "fire", form: "moth", born: "758cc6700442042c541aaf009c63cb669c8f8317bda254d08a8fb0385d4ffb26", grown: "30ea9d26273f3a49de6245f6e59972f49fc360bec2a83197dc51b7c8d39ac192" },
  { seed: "spark1-8-217-1-iuebk69z", name: "Selor", kind: "water", form: "orb", born: "744eeeb238a38eb055230a5a15ccd4b095b3aa4d4c6bf013a4bd1033a99ac8f5", grown: "e8ea57762230c225aaf47c395c1dc5bf0acf9b1beca379017e1956bfd272d63c" },
  { seed: "spark1-9-225-0-wkdp4cv0", name: "Pymior", kind: "fire", form: "shard", born: "d1b3adf61fa8c38f6f171f58aa2d780664080abe8427066fcdd1a10137001f35", grown: "e26149b8c93b98bbb5e40e08971eb783aa9bccea7ba8bdc3d1598a5247da54a4" },
  { seed: "spark1-1-1-0-izsu0fo0", name: "Kara", kind: "fire", form: "shard", born: "7fa67b05c8735e319acc5ceac484e4bc49a54622d0f87c14ed1dc84bb94d3281", grown: "1a70d41b6ff8edbda06772d217c5c75be39e61e998ccab9e301771a186f0e9f3" },
  { seed: "spark1-2-38-1-5c0k6gp0", name: "Selel", kind: "water", form: "shard", born: "85b147bfa3ffba34214adf9ed14da7f83283bfb1677a47288f21e2795602b805", grown: "254ac0f02223df234a13126d5761e2d6bd74ad0c4eb0a36ac9009397cfd04edc" },
  { seed: "spark1-3-75-2-so79chq0", name: "Kael", kind: "shadow", form: "shard", born: "ef1b6862725c31a94019db3544f2b831ebea2f6751442d8684d3b210d9b3d6a7", grown: "8c47ba49a48bbbe22b1c5ccf09b868b75306311bdda160f0510c91791407d200" },
  { seed: "spark1-4-112-3-f1fyhir0", name: "Wilisha", kind: "air", form: "sprout", born: "e3c4287a1db6474ec578cbaed11bea3007b05c31e82434209ba71e6c0b22a4eb", grown: "b8c3217a7f00cbe8696838bb423beaae74ab3d3bf1ed7a3980bf1bb81de4168f" },
  { seed: "spark1-5-149-4-2emnnjs0", name: "Gaor", kind: "earth", form: "sprout", born: "882f5a5ad012e879df565f854c92a4469fef6f07b02b01eef94ef3486f40b2ed", grown: "d8648c9cf1729cce6e82b347a0f51ee983e03ab5408304491585c6445f1359bb" },
  { seed: "spark1-6-186-5-pqtctkt0", name: "Noralo", kind: "light", form: "wave", born: "9cb4058cc1fb0477e9a7140bc0400b3f38e3c7e8013034dc80a4012fbb59cb47", grown: "1bcc432f5548ad2d3e1df41333294fd2dfe41666805e39cb534377905d6ad2d2" },
  { seed: "spark1-7-223-0-c312zlu0", name: "Ashanri", kind: "fire", form: "shard", born: "323e6d974820a478db6a233941fdab005acb00783e88f21b43fad0e267c129b4", grown: "54cddf10fac025bdda314cd96874441282bb969bf8b074902e96e537b342a51b" },
  { seed: "spark1-8-260-1-zf8r4nv0", name: "Naasha", kind: "water", form: "shard", born: "99470c006513ee405f64b3c42fed1cc924bb838b1f317cf28926b52f2cf99c2b", grown: "f72ad90956cb30fed5af64a6b89f3d312074b020eba251d9bca7e59faca10784" },
  { seed: "spark1-9-297-2-msfgaow0", name: "Kari", kind: "shadow", form: "sprout", born: "76865e2cff771ef7c4be7bdb8cdb222857bbe712b7c2d06cb0738b2988c5d453", grown: "758e5237205564e7888be596ba51b24f8fda1a5369061ac104afe29f2499f14f" },
  { seed: "spark1-10-334-3-95n5gpx0", name: "Sirath", kind: "air", form: "comet", born: "7ac6b2853607a5287a50d878c59fc25595928498355b20d157f5a91308ba3049", grown: "72f9a7ef1e5e86303c24440db340dcad55a40b8b64ff43052184ca69e7e2defc" },
  { seed: "spark1-11-7-4-whuulqy0", name: "Ten", kind: "earth", form: "comet", born: "6aa86171a099d08ab160fea006b1111499ba1652b79681b669778c5d1bc5f137", grown: "4e4edbf7a1c4a65c6405a902b3d16cdd268156afe1aa17c11d28ef74aa8e4237" },
  { seed: "spark1-12-44-5-ju1krrz0", name: "Luan", kind: "light", form: "wave", born: "c97206c2b3d1c89888f882f078b15a683e1f68b13c8f8cb73dcd4dbfd69fbe11", grown: "8e393ea6ec2b2f263f7df9fe8c27f46aa40c0603a6d73611ee42d8cfc46026db" },
  { seed: "spark1-13-81-0-6799xs00", name: "Emmi", kind: "fire", form: "moth", born: "79e6883d672271f0572e1f281c93203bae1b83e5e10a2a904fe06ce68f1bc9de", grown: "d2a33a03c0a37eb360c7cd2da7e708270e8bff71d0561f0aa8f2068dc4b2d093" },
  { seed: "spark1-1-118-1-tjgy2u10", name: "Onmi", kind: "water", form: "comet", born: "9295cdc60702ca819de43b2b1b4c1b5a3f9c193c14590e9a773338b74769383c", grown: "ec329feda7d1d1c963d99e49dc0b28b43cd37dd9e1710f067871aca270a69400" },
  { seed: "spark1-2-155-2-gwnn8v20", name: "Umven", kind: "shadow", form: "moth", born: "c827d2fcc4fe357d3681b26c7b929a1f3a2968542e9efb3c9ac5e54aca42888b", grown: "e34b339e370a2ffabb2227ea3422029161d79c53dc8fb5ddc1a5e41520f970d0" },
  { seed: "spark1-3-192-3-39vcew30", name: "Orlin", kind: "air", form: "orb", born: "ec55b6243dba6476a069fc6256f365988e4b7a3edd0c13707e22ed96ef88a4e1", grown: "b5641779887490ccbb427618be9316f13bcf9893d0a2d6c72e1428dd678c06b9" },
  { seed: "spark1-4-229-4-ql22kx40", name: "Maann", kind: "earth", form: "comet", born: "468ba716e5cba81f759ec16a0bfc63b67b83e8320f2a9612b7ef7a052c4031cc", grown: "05af3853a2d3c035c0ebe318e5679b4f6f89b76a99d0387c3244da5772f907be" },
  { seed: "spark1-5-266-5-dy9rpy50", name: "Sori", kind: "light", form: "moth", born: "653834af107c4ab6269de62a92e858e67889d090f60211387a3ea7a999596668", grown: "dbaf273f71ca0061d046f6e83250b02eb31beb3ed54add06ee78930fb1e2e06b" },
  { seed: "spark1-6-303-0-0bhgvz60", name: "Pyera", kind: "fire", form: "wave", born: "559743831455fdb6807d04e460d3bf2fd527839ee80756dff24e16f1feb518b7", grown: "075dd042880b39775dafbee29b5b4af02b5bfeaea4b8504071f6c039b022ca43" },
  { seed: "spark1-7-340-1-nno51180", name: "Selel", kind: "water", form: "sprout", born: "eb215cc59e3b0284359db5943034e47411f849a897b225d688f99187c77e9bdb", grown: "0ea4aa0af3f647ef283648fbacfa1e9fa6913c8da248b1df99de43b9302f3ab5" },
  { seed: "spark1-8-13-2-a0wu6290", name: "Kami", kind: "shadow", form: "moth", born: "b486bb9e7b110ba5e745b2695b67bb5eb210ab1b02484ee87d561ad639787e56", grown: "3122f26b056c676a849c193b6093b2fd940f77ffc946397de8c804b4008e2f4f" },
  { seed: "spark1-9-50-3-xc3kc3a0", name: "Aeemi", kind: "air", form: "shard", born: "d2a4c23b99ea6ee1cacae2c09f91cead8009efe02b564a53113ca13a962cc0ff", grown: "2a38fde95cb7b588a4d98e31e08010d401704bca74c1ad9840d7530ded9a0a64" },
  { seed: "spark1-10-87-4-kpa9i4b0", name: "Gara", kind: "earth", form: "wave", born: "146e65a734589a25ec44a8e16a30d89da12ddbb0f7aa522afba4e57f8f830b7e", grown: "dad1411d4dbc7a7b788459ad94f511ee566ebe1cc07ccea027db84d0dcf6a5c1" },
  { seed: "spark1-11-124-5-72iyn5c0", name: "Amika", kind: "light", form: "comet", born: "60e270b894db38e16164e439f485c078ad3f8061ae0c33760b4f37e0284a6066", grown: "cc14f6b4ef01df4b4e04d323155d23b11d4208ebc3e49dab78be4f7fff73c0f2" }
];

/* The body's own shapes in a born render: the primitives inside
 * the body group that are filled with the body's colour. (In a
 * born render that segment holds only the body, its markings —
 * which wear glow and accent, never the body colour — and the
 * eye.) */
function bodyShapes(svg, bodyFill) {
  const start = svg.indexOf('<g transform="translate(50 54) scale(');
  const end = svg.indexOf('<g transform="translate(50 14)');
  assert.ok(start >= 0 && end > start, "the body group stands in the drawing");
  const seg = svg.slice(start, end);
  const shapes = [];
  const re = /<(ellipse|circle|polygon|path)\b[^>]*?fill="([^"]*)"[^>]*?>/g;
  let m;
  while ((m = re.exec(seg)) !== null) {
    if (m[2] !== bodyFill) continue;
    const tag = m[0];
    const num = (attr) => {
      const a = tag.match(new RegExp(attr + '="([0-9.-]+)"'));
      return a ? Number(a[1]) : null;
    };
    if (m[1] === "ellipse" || m[1] === "circle") {
      const rx = m[1] === "circle" ? num("r") : num("rx");
      const ry = m[1] === "circle" ? num("r") : num("ry");
      shapes.push({ kind: m[1], cx: num("cx"), cy: num("cy"), rx, ry, area: Math.PI * rx * ry });
    } else {
      const nums = (tag.match(/-?\d+\.?\d*/g) || []).map(Number);
      const xs = nums.filter((_, i) => i % 2 === 0);
      const ys = nums.filter((_, i) => i % 2 === 1);
      shapes.push({
        kind: m[1],
        cx: (Math.min(...xs) + Math.max(...xs)) / 2,
        cy: (Math.min(...ys) + Math.max(...ys)) / 2,
        rx: (Math.max(...xs) - Math.min(...xs)) / 2,
        ry: (Math.max(...ys) - Math.min(...ys)) / 2,
        area: (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)),
        bbox: true
      });
    }
  }
  return shapes;
}

function contains(shape, x, y) {
  if (shape.bbox) return Math.abs(x - shape.cx) <= shape.rx && Math.abs(y - shape.cy) <= shape.ry;
  return ((x - shape.cx) / shape.rx) ** 2 + ((y - shape.cy) / shape.ry) ** 2 <= 1;
}

function overlaps(a, b) {
  const dx = (b.cx - a.cx) / ((a.rx + b.rx) / 2);
  const dy = (b.cy - a.cy) / ((a.ry + b.ry) / 2);
  return dx * dx + dy * dy < 4;
}

test("the spread covers every kind and every form", () => {
  assert.ok(SPREAD.length >= 48, `the spread holds ${SPREAD.length} seeds`);
  assert.deepEqual([...new Set(SPREAD.map((s) => s.kind))].sort(), ["air", "earth", "fire", "light", "shadow", "water"]);
  assert.deepEqual([...new Set(SPREAD.map((s) => s.form))].sort(), ["comet", "moth", "orb", "shard", "sprout", "wave"]);
});

test("every seed in the spread generates the Spark its row names", () => {
  for (const row of SPREAD) {
    const c = Core.generate(row.seed);
    assert.ok(c, row.seed);
    assert.equal(c.name, row.name, row.seed);
    assert.equal(c.kind, row.kind, row.seed);
    assert.equal(c.form, row.form, row.seed);
  }
});

test("every seed draws one figure: a single connected body, its largest mass carrying the eye", () => {
  for (const row of SPREAD) {
    const c = Core.generate(row.seed);
    const svg = Core.renderSVG(c, { stage: 0 });
    const shapes = bodyShapes(svg, c.palette.body);
    assert.ok(shapes.length >= 1, `${row.seed}: the body stands in the drawing`);
    // one connected union
    const seen = new Set([0]);
    const queue = [0];
    while (queue.length) {
      const i = queue.pop();
      shapes.forEach((s, j) => {
        if (!seen.has(j) && overlaps(shapes[i], s)) { seen.add(j); queue.push(j); }
      });
    }
    assert.equal(seen.size, shapes.length, `${row.seed} (${row.form}): the body's shapes form one union, not separate masses`);
    // the largest mass carries the eye (the eye stands at 50,52 — at 50,50 on a moth)
    const largest = shapes.reduce((a, b) => (b.area > a.area ? b : a));
    const eyeY = row.form === "moth" ? 50 : 52;
    assert.ok(contains(largest, 50, eyeY), `${row.seed} (${row.form}): the widest body mass carries the eye — no side lobe outweighs the body`);
  }
});

test("the moth's wings are narrower than its body and sunk deep into it", () => {
  for (const row of SPREAD.filter((s) => s.form === "moth")) {
    const c = Core.generate(row.seed);
    const svg = Core.renderSVG(c, { stage: 0 });
    const shapes = bodyShapes(svg, c.palette.body);
    assert.equal(shapes.length, 3, `${row.seed}: a moth is two wings and a body`);
    const body = shapes.find((s) => s.cx === 50);
    assert.ok(body, `${row.seed}: the body stands at the centre`);
    for (const wing of shapes.filter((s) => s.cx !== 50)) {
      assert.ok(body.rx > wing.rx, `${row.seed}: the body (${body.rx}) is wider than a wing (${wing.rx})`);
      const overlap = wing.cx < 50 ? wing.cx + wing.rx - (body.cx - body.rx) : body.cx + body.rx - (wing.cx - wing.rx);
      assert.ok(overlap >= 7, `${row.seed}: a wing sinks ${overlap} units into the body (7 or more)`);
    }
  }
});

test("the figures that already rendered correctly are byte for byte unchanged", () => {
  for (const row of SPREAD.filter((s) => s.form !== "moth")) {
    const c = Core.generate(row.seed);
    assert.equal(sha(Core.renderSVG(c, { stage: 0 })), row.born, `${row.seed} (${row.name}, ${row.form}) born figure moved`);
    assert.equal(sha(Core.renderSVG(c, { stage: 2, revealed: ALL_REVEALED })), row.grown, `${row.seed} (${row.name}, ${row.form}) grown figure moved`);
  }
});

test("the moth figures moved — the fix reached them — and wear the new wing", () => {
  for (const row of SPREAD.filter((s) => s.form === "moth")) {
    const c = Core.generate(row.seed);
    const born = Core.renderSVG(c, { stage: 0 });
    assert.notEqual(sha(born), row.born, `${row.seed}: the moth still draws its old doubled figure`);
    assert.notEqual(sha(Core.renderSVG(c, { stage: 2, revealed: ALL_REVEALED })), row.grown, `${row.seed}: the grown moth still draws its old figure`);
    assert.ok(born.includes('rotate(-20 30.5 42)'), `${row.seed}: the new swept wing stands in the drawing`);
  }
});

test("Selor's own figure is among the pinned, unchanged", () => {
  const row = SPREAD.find((s) => s.seed === "spark1-8-217-1-iuebk69z");
  assert.ok(row, "Selor's seed stands in the spread");
  assert.equal(row.name, "Selor");
  const c = Core.generate(row.seed);
  assert.equal(sha(Core.renderSVG(c, { stage: 0 })), row.born);
});
