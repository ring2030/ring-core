# ring-core — User Guide
### A Guide to Gaze-Based Communication in Care Settings

---

> *"The eyes speak what the lips cannot."*
> This guide is written for everyone who touches ring-core — patients, nurses, and families alike — so that each person can find their place within the system, and so that no voice, however quiet, is ever left unheard.

---

<br>

## Table of Contents

1. [What ring-core Is](#what-ring-core-is)
2. [For Patients](#for-patients)
3. [For Nursing Staff](#for-nursing-staff)
4. [For Families and Loved Ones](#for-families-and-loved-ones)
5. [ring-core as a Platform for Social Research](#ring-core-as-a-platform-for-social-research)

---

<br>

## What ring-core Is

ring-core is a browser-based communication system designed for people who can no longer easily speak or move, particularly elderly patients living with Alzheimer's disease or advanced mobility limitations. At its heart, the system asks very little of the patient: simply look at the screen. The camera observes the movement of the eyes and face, interprets the direction of gaze, and translates that silent intention into action — a call sent, a conversation begun, a need acknowledged.

The interface is deliberately minimal. There are no buttons to press, no menus to navigate, no words to type. Two large panels fill the screen. Looking at one side calls for help with everyday needs. Looking at the other opens a door to conversation with an artificial intelligence companion, trained to listen patiently and respond gently. A soft glow follows the patient's gaze across the screen, confirming that the system sees them. When they hold their gaze on a target long enough — a few quiet seconds — the call is sent.

Nursing staff receive these calls in real time through a structured dashboard, so that every request arrives with context and priority, not as an interruption but as information. Families, who may live far away, receive a daily summary of their loved one's activity, and may send short video messages that appear as a private letter on the patient's screen.

ring-core is not a replacement for human care. It is an instrument that amplifies the patient's diminished voice and makes it possible for caregivers to respond with greater precision and calm.

---

<br>

## For Patients

### Finding Your Place in Front of the Screen

When you arrive at the ring-core screen, you will see two large panels side by side, one on your left and one on your right. These panels are your entire interface. Everything else — the camera, the calculations, the network — works silently in the background, without asking anything of you.

A small glowing circle follows wherever your eyes rest on the screen. This is how the system tells you it can see you. If the light is visible and moving with your gaze, ring-core is ready.

You do not need to do anything to start the camera. It begins automatically when the page opens, and it works with ordinary room lighting. There is no need to sit in a special position, though a comfortable, stable posture — with your face gently facing the screen — will produce the best results. The system is patient. It does not require precision. It is looking for the broad direction of your attention, not the exact position of your pupil.

If you wear glasses, the system can still follow your gaze. If your head moves, the system adjusts. If you look away from the screen entirely, your progress toward any call is gently erased, so that accidental glances never result in unintended calls.

<br>

### The Two Calls: What You Can Ask For

**The Restroom Call** occupies the left panel of the screen. To make this call, look toward the left side of the screen and hold your gaze there. You will see the panel brighten and a gentle progress bar begin to rise from the bottom, like a tide coming in slowly. When the bar reaches the top — after roughly three and a half seconds of sustained attention — the call is sent automatically. A confirmation appears on screen, and a nurse is notified immediately.

This call is designed for the most common and most pressing need in a care setting: assistance with personal hygiene and movement. When a nurse receives a Restroom call, it is marked with high priority in the dashboard. The system notes the time of the call and the context, so that the nurse arrives knowing what is needed without having to ask.

**The Chat Call** occupies the right panel of the screen. Looking toward the right side and holding your gaze there for the same quiet interval will initiate a different kind of response. Rather than summoning a nurse immediately, the Chat call opens a conversation.

Once a Chat call is confirmed, the microphone becomes active. You may speak aloud, and your words will be heard by an artificial intelligence that has been prepared to respond with warmth and care. You might describe how you are feeling. You might mention that something hurts, or that you are lonely, or that you would like music, or simply that today has been a long day. The AI listens, interprets what you have said, and speaks back to you. Simultaneously, it prepares a brief, accurate summary of your request and a priority level, which is sent to the nursing staff so they can follow up in person.

The Chat call is not a substitute for human connection. It is a first layer — something that acknowledges you in the moment, so that you never feel that your words have fallen into silence while you wait.

<br>

### A Note on Patience and Comfort

The system will occasionally lose sight of your face — if you turn away, if the lighting changes, or if you move suddenly. When this happens, your progress toward any call is simply paused, not lost. The moment your gaze returns to a panel, the progress resumes. There is no need to start again.

If the camera is not yet ready when you first look at the screen, a small status message will appear near the top. It will tell you honestly what is happening: whether the model is loading, whether it is waiting for the camera, or whether it has found your face and is ready. This message disappears as soon as the system is prepared.

You are not being watched in any surveillance sense. The camera image never leaves your device. All gaze calculations are performed locally, on the machine in front of you, without sending your image to any server. The only information that travels across the network is the call itself — a record that you looked toward a particular target for long enough to mean it.

---

<br>

## For Nursing Staff

### The Dashboard as a Living Record

When you open the nursing dashboard at `/dashboard/nurse`, what you see is not a static list but a living record of patient needs as they arrive. The dashboard listens to the system's database in real time. A call made by a patient one floor away appears on your screen within seconds of being sent, carrying with it everything you need to respond well: who sent it, when they sent it, what kind of help they need, and how urgently.

Each incoming call appears as a card. The card shows the patient's name, the type of call, and a priority level derived either from the AI's assessment of a voice request or from the default urgency associated with a particular call type. Restroom calls carry a higher default priority, because time and dignity are both at stake. Chat calls that arise from a conversation in which the patient mentioned pain, distress, or a physical symptom will be elevated accordingly by the AI, which assigns numerical priorities on a scale from one to five.

The priority system is not meant to make you choose between patients in a cold algorithmic way. It is meant to give you context when you return from one room and face a queue of waiting notifications. It tells you, as clearly as it can, which need is most urgent and why.

<br>

### Receiving and Understanding a Call

A Restroom call requires no interpretation. A patient looked at the Restroom panel for several seconds. They need assistance. The time is recorded. Your response is expected.

A Chat call is richer in information. When a patient uses the Chat function, their spoken words are transcribed, processed, and summarized by the AI before the result reaches your screen. You will see a brief note — perhaps "patient reports pain in the lower back" or "patient expressed loneliness and asked about the family" — alongside a priority score. This note is not a diagnosis; it is a translation, an attempt to bridge the gap between what the patient said and what you need to know when you walk through the door.

You may also enter care records manually through the staff entry interface at `/dashboard`. This allows you to log interventions that were not initiated by the gaze system: a spontaneous request, a physical check, a moment of comfort offered without prompting. These records join the same database as the automated calls, creating a unified picture of each patient's day.

<br>

### Understanding the Analytics

The dashboard includes charts showing the frequency of calls by type and by time of day. Over weeks and months, these patterns become meaningful. You may notice that a particular patient sends more Restroom calls in the early morning. You may see that Chat calls increase on weekends when fewer visitors arrive. These are not merely statistics. They are stories told slowly, about needs that are being met and needs that are going unnoticed.

The analytics are available to all authenticated staff members. They are intended not as a tool of evaluation — not to measure how quickly you respond — but as a lens through which care itself becomes more visible.

---

<br>

## For Families and Loved Ones

### Staying Close When You Cannot Be Present

Distance is one of the most painful aspects of caring for someone who can no longer fully care for themselves. You may live in another city, or work long hours, or have young children at home. You cannot always be there. ring-core does not pretend to solve this. But it offers something real: a daily account of how your loved one is spending their time, and a small channel through which your affection can travel.

Family members who have been given access to the system — through a secure invitation sent by the care facility — can view the family dashboard at `/dashboard/family`. Here, each day is summarized in language generated by an artificial intelligence that has read through the day's call records: how many times a particular need was expressed, whether the patient seemed distressed or calm, what kinds of requests came in the morning and which came in the evening. The summary is written in plain language, not clinical notation, so that it reads the way a thoughtful person might describe a day to someone who loves the patient.

This summary is not a replacement for speaking to the staff, or for visiting in person. It is a bridge across time — something you can read at the end of your own long day, and feel, however briefly, that you have been given a true account of someone else's.

<br>

### Sending a Video Message

The family dashboard also gives you the ability to upload a short video message. Once uploaded, this video will appear gently on your loved one's screen — not intrusively, not as an interruption, but as a quiet invitation. The patient can choose to watch it when they are ready.

A video message is a remarkable thing in this context. Many patients with cognitive decline respond powerfully to familiar voices and faces, even when words have become difficult. A minute of your face speaking their name, telling them about the weather outside your window or the meal you cooked last night, may reach them in ways that a phone call cannot. The system does not require any technical skill from you: record a short video on your phone or computer, upload it through the family dashboard, and it arrives.

<br>

### Reviewing the History

The history view, available at `/dashboard/history`, allows you to scroll back through previous days, reviewing the record of calls and care events. This view is particularly useful when you want to understand a longer pattern — whether a medication change has had an effect on nighttime agitation, for instance, or whether a new staff member's shift seems to coincide with a reduction in call frequency. These are observations you can bring to a conversation with the care team, grounded in data that neither party has to rely on memory to produce.

---

<br>

## ring-core as a Platform for Social Research

### The Quiet Evidence That Accumulates

Care facilities have always known, in a general way, what their patients need. They have known this from observation, from intuition, from the experience of long-serving staff. What they have lacked, in most cases, is structured, longitudinal evidence — the kind of data that can survive a change in leadership, that can be aggregated across facilities, that can withstand the scrutiny of a policy debate.

ring-core generates this evidence as a byproduct of simply doing its job. Every call is timestamped. Every call carries a type, a priority, a summary, and a record of how it was initiated. Over months and years, this accumulation forms a dataset of exceptional richness: when elderly patients with cognitive decline need assistance, with what frequency, of what kinds, at what hours, and with what consequences when they cannot ask.

This data, anonymized and aggregated, is precisely what is needed to move care policy debates from the realm of anecdote into the realm of evidence.

<br>

### Supporting the Case for Legislative Reform

In many countries, the laws governing elderly care were written in an era when the typical patient could speak clearly and press a physical button. These laws did not anticipate a generation of patients for whom both of those capacities are unavailable. As a result, minimum staffing ratios, response-time requirements, and reimbursement structures often fail to reflect the real intensity of care required for patients with advanced dementia or severe motor disability.

ring-core can serve as the infrastructure for a social experiment — a controlled, facility-level study in which the system is deployed across a network of care homes, and the resulting data is used to build an empirical case for regulatory change. The experiment might ask: how many unmet care needs does the current staffing model leave unaddressed? How does the introduction of gaze-based calling change response times and patient outcomes? What is the economic cost of under-staffing measured not in the abstract but in the concrete record of calls that waited too long?

These are questions that legislators and regulators will take seriously when they are accompanied by evidence. They are questions that advocates have raised for decades without sufficient data to compel a response. ring-core does not answer them by itself. But it creates the conditions in which answers become possible, one timestamped call at a time.

<br>

### A Tool That Grows More Valuable Over Time

The longer ring-core is used, and the more facilities adopt it, the more valuable its data becomes. A single facility's records tell one story. A hundred facilities' records, compared and contrasted, reveal structural patterns — which care models produce better outcomes, which patient populations have the most unmet needs, how geography and funding levels interact with care quality.

This is the vision behind ring-core: not merely a better nurse call button, but a foundation for a more honest conversation about what elderly care in a modern society actually requires, and what it currently fails to provide.

---

<br>

---

<br>
<br>

# ring-core — 利用ガイド
### 視線によるコミュニケーションのためのガイド

---

> *「目は、唇が語れないことを語る。」*
> このガイドは、ring-core に関わるすべての人のために書かれています。患者さま、看護師・介護スタッフの方、そしてご家族の方々が、それぞれに自分の役割を見つけ、どんなにかすかな声も取りこぼされることのない場所を共に築けるように。

---

<br>

## 目次

1. [ring-core とはなにか](#ring-core-とはなにか)
2. [患者さまへ](#患者さまへ)
3. [看護師・介護スタッフの方へ](#看護師介護スタッフの方へ)
4. [ご家族の方へ](#ご家族の方へ)
5. [社会実験・制度改革のための基盤として](#社会実験制度改革のための基盤として)

---

<br>

## ring-core とはなにか

ring-core は、声を出すことも手を動かすことも難しくなった方々のために設計された、ブラウザ上で動作するコミュニケーションシステムです。対象は、アルツハイマー型認知症や重度の運動障害をもつ高齢の患者さまです。このシステムが患者さまに求めることは、ただひとつ — 画面を「見る」ことだけです。

カメラが目と顔の動きを観察し、視線の方向を解釈し、その無言の意図を行動へと変換します。コールが送られ、会話が始まり、ニーズが認識される。インターフェースは意図的にシンプルに設計されています。押すべきボタンも、たどるべきメニューも、入力すべき文字もありません。画面を満たすのは、ふたつの大きなパネルだけです。片方を見ることで日常的なニーズのためのコールができ、もう片方を見ることでAIとの会話の扉が開かれます。

看護師はリアルタイムで構造化されたダッシュボードを通じてコールを受け取るため、すべてのリクエストが割り込みとしてではなく、文脈と優先度を持つ「情報」として届きます。離れて暮らすご家族には、患者さまの一日の活動サマリーがAIによって生成され、また短いビデオメッセージを患者さまの画面に届けることができます。

ring-core は人間によるケアの代替ではありません。患者さまの弱まった声を増幅し、介護者がより正確に、より穏やかに応答できるようにするための道具です。

---

<br>

## 患者さまへ

### 画面の前に座って

ring-core の画面が開かれると、左右にひとつずつ、大きなパネルが並んでいます。このふたつのパネルが、あなたのすべてのインターフェースです。カメラも、計算も、ネットワークも、すべてが静かに背後で動き、あなたに何かを求めることはありません。

視線が画面のどこかに落ちると、そこに小さな光のカーソルが現れ、目の動きとともに移動します。これは、システムがあなたを認識していることを伝える合図です。この光が見え、あなたの視線に従って動いているなら、ring-core はいつでも準備ができています。

カメラを起動するために何かをする必要はありません。ページを開けば自動的に起動し、通常の室内照明のもとで動作します。特別な姿勢をとる必要もありませんが、顔が画面にやわらかく向いた、安定した姿勢が最も良い結果をもたらします。システムは辛抱強く待ちます。精密さは求めません。瞳の正確な位置ではなく、あなたの注意の大まかな方向を読み取るように設計されています。

眼鏡をかけていても、システムは視線を追うことができます。頭が動けば、システムはそれに合わせて調整します。画面から完全に視線をそらせば、コールに向かっていた進行状況はやさしく消去されますので、意図せぬ視線が意図しないコールを送ることはありません。

<br>

### ふたつのコール — あなたが伝えられること

**トイレコール（Restroom）** は画面の左側のパネルに表示されています。このコールを行うには、画面の左側を見て、そこに視線を保ちます。パネルが明るくなり、底から波のようにゆっくりとプログレスバーが上がり始めます。バーが頂点に達したとき — 約3秒半の集中した視線のあと — コールが自動的に送信されます。画面に確認メッセージが表示され、看護師にただちに通知が届きます。

このコールは、介護の現場でもっとも日常的で、もっとも切迫したニーズ — 身の回りの介助や移動の補助 — のために設計されています。看護師がトイレコールを受け取ると、ダッシュボードでは高い優先度として表示されます。コールの時刻と文脈が記録されるため、看護師は何が必要かを尋ねることなく応じることができます。

**お話コール（Chat）** は画面の右側のパネルに表示されています。右側を見て、同じ静かな時間だけ視線を保つと、別の種類の応答が始まります。コールが確認されると、マイクが有効になります。声に出して話すことができ、その言葉は、辛抱強く、やさしく応答するために準備されたAIに届きます。

今の気持ちを話してもよいし、どこかが痛むことや、寂しいことや、音楽が聴きたいことや、ただ今日は長い一日だったということを伝えるだけでも構いません。AIはあなたの言葉を聞き、解釈し、話し返します。同時に、あなたのリクエストの簡潔で正確なサマリーと優先度を看護師のダッシュボードに送信し、スタッフが直接フォローアップできるようにします。

お話コールは、人間的なつながりの代替ではありません。それは最初の層 — あなたが待つ間に、あなたの声を即座に認識してくれる何か — として存在します。言葉が沈黙の中に落ちていくような感覚を覚えることなく、誰かに届いたと感じられるように。

<br>

### 忍耐と安心について

システムはときどきあなたの顔を見失うことがあります — 顔をそむけたとき、照明が変わったとき、突然動いたとき。そのようなときでも、コールへの進行状況は停止するだけで、リセットはされません。視線がパネルに戻ると、進行は再開します。最初からやり直す必要はありません。

ページを最初に開いたとき、カメラがまだ準備できていない場合は、画面上部に小さなステータスメッセージが表示されます。モデルを読み込んでいるのか、カメラを待っているのか、顔を認識してコールできる状態になったのか、正直に伝えてくれます。システムの準備が整ったとき、このメッセージは静かに消えます。

カメラによって何かを監視されているわけではありません。カメラの映像はあなたのデバイスから外へ出ることは決してありません。すべての視線計算は、目の前のマシン上で、どのサーバーにも画像を送ることなく、ローカルで行われます。ネットワークを通じて伝わる情報は、コールそのものだけです — あなたが十分な時間、特定のターゲットに視線を向けたというその記録だけが送信されます。

---

<br>

## 看護師・介護スタッフの方へ

### 生きた記録としてのダッシュボード

看護師ダッシュボード（`/dashboard/nurse`）を開くと、静的なリストではなく、リアルタイムで届く患者さまのニーズの生きた記録が目の前に広がります。ダッシュボードはシステムのデータベースを常時監視しています。一階層離れた部屋から送られたコールは、送信から数秒以内に画面に現れ、的確に応じるために必要な情報 — 誰が、いつ、何を、どれほど緊急に求めているか — をすべて携えています。

届くコールはカードとして表示されます。カードには患者さまの名前、コールの種類、そして優先度が示されます。優先度は、音声リクエストに対するAIの評価か、コールの種類に応じたデフォルトの緊急度から導かれます。トイレコールはデフォルトで高い優先度を持ちます。時間と尊厳がともに問われているからです。痛みや苦痛、身体的症状に言及した会話から生まれたお話コールは、その内容をAIが読み取り、1から5のスケールで優先度を引き上げます。

この優先度システムは、冷たいアルゴリズムで患者さまを選り分けるためにあるのではありません。ある部屋から戻り、待機する通知の列に向き合ったとき、どのニーズがもっとも緊急でなぜそうなのかを、できるかぎり明確に伝えるためにあります。

<br>

### コールを受け取り、理解する

トイレコールに解釈の余地はありません。患者さまが数秒間、トイレのパネルに視線を向けていました。介助が必要です。時刻が記録されています。あなたの応答が待たれています。

お話コールはより豊かな情報を持ちます。患者さまがお話機能を使ったとき、その言葉は転写され、処理され、AIによってサマリーにまとめられてから画面に届きます。「腰に痛みがあると訴えている」「孤独を感じており、家族のことを尋ねていた」といった短い備考と優先度スコアが表示されます。これは診断ではありません。患者さまが言ったことと、あなたが部屋に入るときに知っておくべきことの間を橋渡しする、一種の翻訳です。

また、スタッフ入力インターフェース（`/dashboard`）から手動でケア記録を入力することもできます。視線システムを通じたコールではなく、自発的なリクエスト、身体チェック、声がけなど、あなたが行ったすべてのケアをここに記録できます。これらの記録は自動コールと同じデータベースに加わり、各患者さまの一日の統合された記録を形成します。

<br>

### データを読む

ダッシュボードにはコールの種類と時間帯別の頻度を示すグラフが含まれています。週や月を重ねるにつれ、このパターンは意味を持ち始めます。特定の患者さまが早朝にトイレコールを多く送ることに気づくかもしれません。週末に訪問者が少なくなると、お話コールが増えることを見つけるかもしれません。これらは単なる統計ではありません。充たされているニーズと見過ごされているニーズについて、時間をかけて語られていく物語です。

分析機能はすべての認証済みスタッフが利用できます。これは、あなたの応答速度を測る評価ツールではなく、ケアそのものをより可視化するための視点として設計されています。

---

<br>

## ご家族の方へ

### 傍にいられないときでも、傍にいるために

大切な人のケアに関わる中で、もっとも辛い側面のひとつは、距離です。別の街に住んでいたり、長時間働いていたり、幼い子どもがいたりして、いつもそこにいることはできません。ring-core はこの問題を解決するとは言いません。しかし、確かなものを提供しています — 大切な人が今日をどのように過ごしているかの日々の報告と、あなたの想いが届く小さな通路を。

施設から安全な招待状によってシステムへのアクセスを与えられた家族の方々は、家族ダッシュボード（`/dashboard/family`）を閲覧できます。ここでは、AIが一日のコール記録を読み解き、生成した言葉で各日がまとめられています。特定のニーズが何回表現されたか、患者さまが苦しんでいたのか穏やかだったのか、朝にどんなリクエストがあり、夕方にはどんなリクエストがあったか。サマリーは臨床的な記述ではなく、平易な言葉で書かれています。患者さまを愛する人に対して、思慮深い人が一日を語るように。

このサマリーはスタッフと話すことや、直接訪問することの代替ではありません。時間を越えた橋です — 自分自身の長い一日の終わりに読み、大切な人の一日について、誠実な報告を受け取ったと感じることのできる何かです。

<br>

### ビデオメッセージを届ける

家族ダッシュボードでは、短いビデオメッセージをアップロードすることもできます。アップロードされたビデオは、患者さまの画面に静かに届きます — 強引にではなく、割り込みとしてでもなく、やさしい招待として。患者さまは準備ができたときに見ることができます。

この文脈において、ビデオメッセージというものは特別な意味を持ちます。認知機能の低下した多くの患者さまは、言葉が難しくなっていても、慣れ親しんだ声と顔に強く反応します。窓の外の天気や、昨晩作った食事について話しながらあなたの顔が映る一分間の映像は、電話では届かない深いところに届くかもしれません。技術的なスキルは必要ありません。スマートフォンやパソコンで短い動画を撮影し、家族ダッシュボードからアップロードするだけで、それは届きます。

<br>

### 記録をふり返る

履歴ビュー（`/dashboard/history`）では、過去の日々を遡り、コールとケアイベントの記録を見ることができます。このビューは、より長いパターンを把握したいときに特に役立ちます。たとえば、薬の変更が夜間の不穏行動に影響を与えているかどうか、あるいは新しいスタッフのシフトがコール頻度の変化と一致しているかどうか。こうした観察はケアチームとの対話に持ち込むことができ、どちらの側も記憶に頼ることなく、データという共通の基盤の上に立って話し合うことができます。

---

<br>

## 社会実験・制度改革のための基盤として

### 静かに積み重なっていく証拠

介護施設は常に、大まかな意味で、患者さまが何を必要としているかを知っていました。観察から、直感から、長年のスタッフの経験から。しかし多くの場合、欠けていたのは構造化された縦断的なデータ — リーダーシップの交代を超えて生き残り、施設をまたいで集積され、政策論争の精査に耐えられる種類の証拠でした。

ring-core は、ただそのしごとをするだけで、こうした証拠を副産物として生み出します。すべてのコールにはタイムスタンプが記録されます。すべてのコールにはコールの種類、優先度、サマリー、そして送信された経緯の記録があります。月と年を重ねるにつれ、この蓄積は類稀な豊かさを持つデータセットとなります — 認知機能が低下した高齢患者さまがいつ、どれほどの頻度で、どのような種類の介助を、どの時間帯に必要としているか、そしてその声が届かなかったとき何が起きるか。

こうしたデータは、匿名化・集計された形で、介護政策の議論を逸話の領域から証拠の領域へと移動させるために、まさに必要とされているものです。

<br>

### 制度改革への訴えを支える

多くの国において、高齢者介護に関する法律は、典型的な患者さまが明確に話し、物理的なボタンを押すことができた時代に書かれました。これらの法律は、そのどちらの能力も失ってしまった世代を想定していませんでした。その結果、最低人員配置基準、応答時間の要件、報酬体系などが、進行した認知症や重度の運動障害を抱える患者さまに必要なケアの実際の強度を反映できていないことが多々あります。

ring-core は社会実験の基盤として機能できます — 複数の介護施設にシステムを展開し、得られたデータをもとに制度改革の実証的な根拠を構築する、施設単位の統制された研究です。この実験が問えることは多岐にわたります。現在の人員配置モデルは、どれほどの未充足ニーズを残しているのか。視線入力によるコールシステムの導入は、応答時間と患者アウトカムをどのように変えるのか。人員不足の経済的コストを、待ちすぎたコールの具体的な記録として測定するとどうなるのか。

これらは、証拠が伴うとき、立法者や規制当局が真剣に受け止める問いです。提唱者たちが数十年にわたって提起してきたものの、応答を迫るに十分なデータがなかった問いです。ring-core はそれ自体で答えを出しません。しかし答えが可能になる条件を創り出します — タイムスタンプの刻まれたコールを、一件ずつ積み重ねながら。

<br>

### 使われるほどに価値が増すシステム

ring-core が長く使われるほど、そして採用する施設が増えるほど、そのデータはより価値を持ちます。単一施設の記録はひとつの物語を語ります。百の施設の記録を比較・対照すると、構造的なパターンが浮かび上がります — どのケアモデルがより良いアウトカムをもたらすか、どの患者層がもっとも多くの未充足ニーズを抱えているか、地域と財政的な条件がケアの質とどのように相互作用するか。

これが ring-core の背後にあるビジョンです — より良いナースコールボタンというだけでなく、現代社会における高齢者介護が実際に何を必要としているか、そして今何を提供できていないかについて、より誠実な対話のための基盤として。

---

<br>

*このガイドについてご不明な点があれば、施設のスタッフまたはシステム管理者にお問い合わせください。*
*For questions about this guide, please contact your facility's staff or system administrator.*
