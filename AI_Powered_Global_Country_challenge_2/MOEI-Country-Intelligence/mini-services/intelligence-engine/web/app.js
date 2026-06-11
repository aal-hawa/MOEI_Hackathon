// MOEI Country Intelligence — front-end (vanilla JS, multi-section SPA)
let LANG = "en";
let CURRENT = null;        // last loaded dossier payload
let CURRENT_RUN = null;    // run_id of the live/last build
let WS_TAB = "briefing";   // active workspace tab
let MEM_TIMER = null;      // memory polling during a build
const USER = "admin";

const I18N = {
  en: { title:"Ministry of Energy & Infrastructure — Country Intelligence",
    sub:"AI-powered, source-verified country dossiers · no hallucination",
    nav_home:"Home", nav_chat:"Chat", nav_briefings:"Briefings", nav_compare:"Compare",
    nav_sources:"Sources", nav_params:"Parameters", nav_logs:"Logs",
    home_h:"Prepare leadership in seconds",
    home_p:"Ask anything — or type a country to get a verified, decision-ready briefing: summary, talking points, opportunities, council verdict and forecast.",
    home_brief:"Brief →", home_ask:"Ask", home_ph:"Ask anything, or type a country… e.g. Kazakhstan",
    news_h:"Central Asia × UAE — latest signals", live:"LIVE", offline:"offline sample",
    home_recent:"Recently built dossiers",
    stat_countries:"countries in Library", stat_facts:"verified facts", stat_domains:"intelligence domains", stat_nohall:"invented facts",
    chath:"Where should we start?", chatp:"Strategic questions across countries — answered from the verified Library first, with cited research for specifics.",
    chat_ph:"Ask the intelligence assistant…", thinking:"Researching…",
    chip_last:"🕑 About the last briefing", chip_cmp:"⚖ Kazakhstan vs Uzbekistan", chip_opp:"🤝 Central Asia opportunities", chip_nz:"🌱 Net-zero targets",
    br_h:"Country briefings", br_p:"Open an existing briefing or build a new one. Each briefing has its own workspace: agent progress, the brief, UAE relations, analysis, forecast and the Visualization Lab.",
    br_open:"Open briefing →", br_lib:"Library", placeholder:"e.g. Kazakhstan",
    prog:"Live agent progress & reasoning", memory_h:"Agent working memory (per-agent notes this run)",
    tab_progress:"⚙ Agents & reasoning", tab_briefing:"📋 Briefing", tab_uae:"🇦🇪 UAE Relations", tab_opps:"⚖ Opportunities & Risks",
    tab_pred:"🔮 Predictive Outlook", tab_talk:"🗣 Talking Points", tab_council:"🏛 Council Verdict",
    tab_identity:"🏛 Identity & Governance", tab_economy:"💹 Economy & Trade", tab_energy:"⚡ Energy · Infra · Sustainability · Innovation",
    tab_lab:"🎬 Visualization Lab",
    coverage:"data coverage", fields:"fields", refresh:"↻ Re-research",
    summary:"Executive summary", analysis:"Opportunities & risks (analysis)", tp:"Talking points",
    predictive:"Predictive outlook (projection)", council_h:"The Council — multi-perspective review",
    council_p:"Four senior seats debate the analyst & predictive drafts, then issue a consensus verdict. No new facts are ever added.",
    verdict:"Council verdict", notfound:"Not found", notfoundval:"NOT FOUND", history:"history", edit:"edit",
    source:"Source", field:"Field", value:"Value", corr:"corroborated", manual:"manual",
    cmp_h:"Compare countries", cmp_p:"Enter 2–4 countries (comma-separated). Same metric, each with its own source & year; gaps shown, never filled.",
    cmp_btn:"Compare →", metric:"Metric", insight:"Comparative insight (analysis)",
    src_h:"Trusted source registry", src_p:"Every source the platform may use — auto-populated as dossiers are built. Block a source to drop it from all future research, or add your own.",
    src_add:"+ Add", src_block:"Block", src_unblock:"Unblock", src_blocked:"blocked", src_trusted:"trusted",
    src_total:"sources", src_seen:"Times used", col_source:"Source", col_cat:"Category", tier_l:"Tier",
    seed_l:"registry", auto_l:"auto-discovered", manual_l:"added by you",
    keys_h:"Paid & private sources", keys_p:"Connect premium providers (e.g. Bloomberg, S&P Capital IQ) with an API key. Keys are stored locally and shown masked.",
    keys_add:"Connect", keys_none:"No paid sources connected yet.", keys_remove:"Remove",
    int_h:"Internal database", int_p:"Link internal ministry data (CSV / JSON). It stays on this machine.",
    int_iso:"🔒 ISOLATION GUARANTEE — internal data is never sent to the web, never shared with external AI providers, and never mixed into agent research context.",
    int_add:"Link dataset", int_none:"No internal datasets linked.", int_rows:"rows", int_badge:"INTERNAL — never leaves this machine",
    par_h:"Parameters — the agent team", par_p:"Choose which AI model powers each agent. Changes apply immediately (hot-reload) and are saved to the model map. Compass sovereign targets are available as options.",
    par_save:"Save", par_saved:"✓ saved", par_temp:"temperature",
    log_h:"Activity logs", log_p:"Who did what — every agent step (with its reasoning) and every admin action, fully audited.",
    log_ai:"🤖 AI log", log_user:"👤 User log", log_all:"All", log_when:"When", log_actor:"Actor", log_action:"Action", log_detail:"Detail",
    ts_tag:"Executive tear sheet", print:"🖨 Print / PDF", trajectory:"Trajectory",
    exP:"Top export partners", imP:"Top import partners", exG:"Top exported goods", imG:"Top imported goods",
    spotlight:"Sector spotlight", uaesnap:"The UAE angle", snapshot:"At a glance", tradeyear:"trade year",
    deepdive:"Deep dive: summary, talking points, opportunities & forecast", noread:"Add an AI key (.env) to generate the executive read.",
    gdppc:"GDP per capita", dashboard_tab:"📊 Dashboard", report_tab:"📄 Report",
    ppt_dash:"Slides (PPTX)", pdf_report:"Report (PDF)", onepager:"One-pager (SVG)", excel:"Data (Excel)",
    dash_indicators:"Key indicators", dash_visuals:"Visual intelligence", na:"NOT AVAILABLE",
    insights:"Executive insights", opportunities:"Opportunities", risks:"Risks",
    fulldata:"Full data & sources", keyindicators:"Key indicators (with trend)", trade_sectors:"Trade & sectors",
    lab_h:"Visualization Lab", lab_p:"Export this briefing as executive-ready material — slides, a smart report, a one-pager, or a live dashboard. Pick the sections to include for print/one-pager.",
    lab_ppt:"Executive slides", lab_ppt_d:"Branded PPTX deck with charts, KPIs and the read", lab_pdf:"Smart report", lab_pdf_d:"Organized PDF: summary, analysis, talking points, forecast",
    lab_xls:"Data workbook", lab_xls_d:"Every verified field with source, tier and date", lab_svg:"Beautiful one-pager", lab_svg_d:"Visual infographic from verified data only",
    lab_dash:"Live dashboard", lab_dash_d:"Interactive charts designed by the Visualizer agent", lab_print:"Print selection", lab_print_d:"Print / save the sections you ticked below",
    updates:"Check updates", nochanges:"No changes detected", changes_found:"update(s) detected",
    uae_h:"UAE — bilateral relationship", uae_p:"Ambassadors, UAE companies investing, partnerships and cooperation — verified items with sources.",
    amb:"Ambassadors & embassies", inv:"UAE companies & investments", agr:"Agreements & partnerships", coop:"Cooperation & visits",
    exports_w:"exports", imports_w:"imports" },
  ar: { title:"وزارة الطاقة والبنية التحتية — الذكاء القُطري",
    sub:"ملفات قُطرية مُتحقَّق من مصادرها بالذكاء الاصطناعي · بلا هلوسة",
    nav_home:"الرئيسية", nav_chat:"محادثة", nav_briefings:"الإحاطات", nav_compare:"مقارنة",
    nav_sources:"المصادر", nav_params:"الإعدادات", nav_logs:"السجلات",
    home_h:"جهّز القيادة في ثوانٍ",
    home_p:"اسأل أي شيء — أو اكتب اسم دولة لتحصل على إحاطة موثّقة جاهزة للقرار: ملخص، نقاط حديث، فرص، حكم المجلس وتوقعات.",
    home_brief:"إحاطة ←", home_ask:"اسأل", home_ph:"اسأل أي شيء، أو اكتب دولة… مثال: كازاخستان",
    news_h:"آسيا الوسطى × الإمارات — أحدث الإشارات", live:"مباشر", offline:"عينة (دون اتصال)",
    home_recent:"أحدث الملفات",
    stat_countries:"دولة في المكتبة", stat_facts:"حقائق مُتحقَّقة", stat_domains:"مجالات الاستخبارات", stat_nohall:"حقائق مُختلَقة",
    chath:"من أين نبدأ؟", chatp:"أسئلة استراتيجية عبر الدول — تُجاب من المكتبة المُتحقَّقة أولًا، مع بحث موثّق للتفاصيل.",
    chat_ph:"اسأل مساعد الاستخبارات…", thinking:"جارٍ البحث…",
    chip_last:"🕑 عن آخر إحاطة", chip_cmp:"⚖ كازاخستان مقابل أوزبكستان", chip_opp:"🤝 فرص آسيا الوسطى", chip_nz:"🌱 أهداف الحياد الكربوني",
    br_h:"إحاطات الدول", br_p:"افتح إحاطة قائمة أو أنشئ واحدة جديدة. لكل إحاطة مساحة عملها: تقدّم الوكلاء، الموجز، العلاقات مع الإمارات، التحليل، التوقعات ومختبر العرض.",
    br_open:"افتح الإحاطة ←", br_lib:"المكتبة", placeholder:"مثال: كازاخستان",
    prog:"تقدّم الوكلاء وتفكيرهم المباشر", memory_h:"الذاكرة العاملة للوكلاء (ملاحظات هذا التشغيل)",
    tab_progress:"⚙ الوكلاء والتفكير", tab_briefing:"📋 الإحاطة", tab_uae:"🇦🇪 العلاقات مع الإمارات", tab_opps:"⚖ الفرص والمخاطر",
    tab_pred:"🔮 التوقعات", tab_talk:"🗣 نقاط الحديث", tab_council:"🏛 حكم المجلس",
    tab_identity:"🏛 الهوية والحوكمة", tab_economy:"💹 الاقتصاد والتجارة", tab_energy:"⚡ الطاقة · البنية · الاستدامة · الابتكار",
    tab_lab:"🎬 مختبر العرض",
    coverage:"تغطية البيانات", fields:"حقل", refresh:"↻ إعادة البحث",
    summary:"الملخص التنفيذي", analysis:"الفرص والمخاطر (تحليل)", tp:"نقاط الحديث",
    predictive:"التوقعات المستقبلية (إسقاط)", council_h:"المجلس — مراجعة متعددة المنظورات",
    council_p:"أربعة مقاعد رفيعة تناقش مسودات المحلل والتوقعات ثم تصدر حكمًا توافقيًا. لا تُضاف حقائق جديدة أبدًا.",
    verdict:"حكم المجلس", notfound:"غير متوفر", notfoundval:"غير متوفر", history:"السجل", edit:"تعديل",
    source:"المصدر", field:"الحقل", value:"القيمة", corr:"مؤكَّد من مصدرين", manual:"يدوي",
    cmp_h:"مقارنة الدول", cmp_p:"أدخل دولتين إلى أربع (مفصولة بفواصل). نفس المؤشر، لكل قيمة مصدرها وسنتها؛ تُعرض الفجوات ولا تُملأ.",
    cmp_btn:"قارن ←", metric:"المؤشر", insight:"تحليل المقارنة",
    src_h:"سجل المصادر الموثوقة", src_p:"كل مصدر يُسمح للمنصة باستخدامه — يُحدَّث تلقائيًا أثناء بناء الملفات. احجب مصدرًا لاستبعاده، أو أضف مصدرك.",
    src_add:"+ إضافة", src_block:"حجب", src_unblock:"إلغاء الحجب", src_blocked:"محجوب", src_trusted:"موثوق",
    src_total:"مصدر", src_seen:"مرات الاستخدام", col_source:"المصدر", col_cat:"الفئة", tier_l:"المستوى",
    seed_l:"السجل", auto_l:"مُكتشَف تلقائيًا", manual_l:"مُضاف يدويًا",
    keys_h:"المصادر المدفوعة والخاصة", keys_p:"اربط مزوّدين مدفوعين (مثل بلومبرغ) بمفتاح API. تُحفظ المفاتيح محليًا وتُعرض مُقنَّعة.",
    keys_add:"ربط", keys_none:"لا مصادر مدفوعة بعد.", keys_remove:"إزالة",
    int_h:"قاعدة البيانات الداخلية", int_p:"اربط بيانات الوزارة الداخلية (CSV / JSON). تبقى على هذا الجهاز.",
    int_iso:"🔒 ضمان العزل — البيانات الداخلية لا تُرسل أبدًا إلى الويب ولا لمزوّدي الذكاء الخارجيين ولا تُخلط بسياق بحث الوكلاء.",
    int_add:"ربط البيانات", int_none:"لا بيانات داخلية مرتبطة.", int_rows:"صف", int_badge:"داخلي — لا يغادر هذا الجهاز",
    par_h:"الإعدادات — فريق الوكلاء", par_p:"اختر نموذج الذكاء لكل وكيل. تُطبَّق التغييرات فورًا وتُحفظ في خريطة النماذج.",
    par_save:"حفظ", par_saved:"✓ حُفظ", par_temp:"درجة الحرارة",
    log_h:"سجلات النشاط", log_p:"من فعل ماذا — كل خطوة وكيل (مع تفكيرها) وكل إجراء إداري، مُدقَّق بالكامل.",
    log_ai:"🤖 سجل الذكاء", log_user:"👤 سجل المستخدم", log_all:"الكل", log_when:"الوقت", log_actor:"الفاعل", log_action:"الإجراء", log_detail:"التفاصيل",
    ts_tag:"بطاقة تنفيذية", print:"🖨 طباعة / PDF", trajectory:"المسار",
    exP:"أهم شركاء التصدير", imP:"أهم شركاء الاستيراد", exG:"أهم السلع المُصدَّرة", imG:"أهم السلع المستوردة",
    spotlight:"تسليط على القطاعات", uaesnap:"زاوية الإمارات", snapshot:"لمحة سريعة", tradeyear:"سنة التجارة",
    deepdive:"تعمّق: ملخص، نقاط حديث، فرص وتوقعات", noread:"أضف مفتاح ذكاء اصطناعي لإنشاء الخلاصة التحليلية.",
    gdppc:"نصيب الفرد من الناتج", dashboard_tab:"📊 لوحة المعلومات", report_tab:"📄 التقرير",
    ppt_dash:"شرائح (PPTX)", pdf_report:"تقرير (PDF)", onepager:"صفحة واحدة (SVG)", excel:"بيانات (Excel)",
    dash_indicators:"المؤشرات الرئيسية", dash_visuals:"الذكاء البصري", na:"غير متوفر",
    insights:"رؤى تنفيذية", opportunities:"الفرص", risks:"المخاطر",
    fulldata:"كل البيانات والمصادر", keyindicators:"المؤشرات الرئيسية (مع الاتجاه)", trade_sectors:"التجارة والقطاعات",
    lab_h:"مختبر العرض", lab_p:"صدّر هذه الإحاطة كمواد تنفيذية — شرائح، تقرير ذكي، صفحة واحدة، أو لوحة حيّة. اختر الأقسام للطباعة.",
    lab_ppt:"شرائح تنفيذية", lab_ppt_d:"عرض PPTX بالهوية مع رسوم ومؤشرات", lab_pdf:"تقرير ذكي", lab_pdf_d:"PDF منظم: ملخص، تحليل، نقاط حديث، توقعات",
    lab_xls:"مصنّف بيانات", lab_xls_d:"كل حقل مُتحقَّق مع مصدره ومستواه وتاريخه", lab_svg:"صفحة واحدة جميلة", lab_svg_d:"إنفوجرافيك من البيانات المُتحقَّقة فقط",
    lab_dash:"لوحة حيّة", lab_dash_d:"رسوم تفاعلية صممها وكيل العرض", lab_print:"طباعة المحدد", lab_print_d:"اطبع/احفظ الأقسام التي اخترتها",
    updates:"تحقق من التحديثات", nochanges:"لا تغييرات", changes_found:"تحديث/تحديثات",
    uae_h:"الإمارات — العلاقة الثنائية", uae_p:"السفراء، الشركات الإماراتية المستثمرة، الشراكات والتعاون — بنود موثّقة بمصادرها.",
    amb:"السفراء والسفارات", inv:"الشركات والاستثمارات الإماراتية", agr:"الاتفاقيات والشراكات", coop:"التعاون والزيارات",
    exports_w:"صادرات", imports_w:"واردات" },
};

const LABELS = { en:{}, ar:{} };
Object.assign(LABELS.en, {
  official_name:"Official name", capital:"Capital", region:"Region", subregion:"Subregion",
  languages:"Languages", currency:"Currency", timezone:"Timezone", flag:"Flag",
  political_system:"Political system", head_of_state:"Head of state", head_of_government:"Head of government",
  key_decision_makers:"Key decision-makers", sovereign_wealth_funds:"Sovereign wealth funds", national_vision_strategy:"National vision",
  gdp_nominal_usd:"GDP (nominal)", gdp_per_capita_usd:"GDP per capita", gdp_growth_pct:"GDP growth",
  inflation_pct:"Inflation", unemployment_pct:"Unemployment", population:"Population",
  current_account_pct_gdp:"Current account (% GDP)", exports_usd:"Exports", imports_usd:"Imports",
  fdi_inflow_usd:"FDI inflow", govt_debt_pct_gdp:"Govt debt (% GDP)", sovereign_credit_rating:"Credit rating",
  competitiveness_rank:"Competitiveness rank", trade_agreements:"Trade agreements", gdp_by_sector:"GDP by sector",
  agriculture_pct_gdp:"Agriculture (% GDP)", industry_pct_gdp:"Industry (% GDP)", services_pct_gdp:"Services (% GDP)",
  renewable_energy_consumption_pct:"Renewable energy use", renewable_electricity_output_pct:"Renewable electricity",
  electric_power_consumption_pc:"Electricity use per capita", access_to_electricity_pct:"Access to electricity",
  electricity_mix:"Electricity mix", installed_renewable_capacity:"Installed renewable capacity",
  oil_gas_reserves:"Oil & gas reserves", energy_renewable_target:"Renewable target", hydrogen_strategy:"Hydrogen strategy",
  major_energy_projects:"Major energy projects", national_energy_players:"National energy players",
  logistics_performance_index:"Logistics (LPI)", internet_users_pct:"Internet users",
  mobile_subscriptions_per100:"Mobile subscriptions", urban_population_pct:"Urban population",
  major_ports:"Major ports", major_airports:"Major airports", infrastructure_project_pipeline:"Infrastructure pipeline",
  rail_road_networks:"Rail & road networks", digital_infrastructure_5g:"Digital infrastructure / 5G", ppp_landscape:"PPP landscape",
  co2_emissions_per_capita:"CO2 per capita", net_zero_target:"Net-zero target", climate_commitments_ndc:"Climate commitments (NDC)",
  environmental_performance_index:"Environmental Performance Index", green_finance_initiatives:"Green finance",
  rd_spend_pct_gdp:"R&D spend (% GDP)", global_innovation_index_rank:"Global Innovation Index rank",
  smart_city_initiatives:"Smart-city initiatives", digital_government_maturity:"Digital government maturity", tech_ecosystem_highlights:"Tech ecosystem",
  uae_bilateral_agreements:"UAE agreements / MoUs", uae_bilateral_trade:"UAE bilateral trade", uae_companies_present:"UAE companies present",
  uae_joint_ventures:"UAE joint ventures", uae_cooperation_areas:"UAE cooperation areas", uae_diplomatic_status:"UAE diplomatic status",
  uae_ambassadors:"Ambassadors (UAE ↔)", uae_embassy_presence:"Embassies & consulates", uae_investments:"UAE investments",
  uae_recent_visits:"Recent high-level visits",
  recent_developments:"Recent developments", upcoming_events:"Upcoming events", recent_energy_infra_announcements:"Recent energy/infra announcements",
  top_export_partners:"Top export partners", top_import_partners:"Top import partners", top_exports:"Top exports", top_imports:"Top imports",
  momentum_sectors:"Momentum sectors", structural_shift:"Structural shift",
});
Object.assign(LABELS.ar, {
  official_name:"الاسم الرسمي", capital:"العاصمة", region:"المنطقة", subregion:"المنطقة الفرعية",
  languages:"اللغات", currency:"العملة", timezone:"المنطقة الزمنية", flag:"العلم",
  political_system:"النظام السياسي", head_of_state:"رئيس الدولة", head_of_government:"رئيس الحكومة",
  key_decision_makers:"صنّاع القرار", sovereign_wealth_funds:"صناديق الثروة السيادية", national_vision_strategy:"الرؤية الوطنية",
  gdp_nominal_usd:"الناتج المحلي الإجمالي", gdp_per_capita_usd:"نصيب الفرد من الناتج", gdp_growth_pct:"نمو الناتج",
  inflation_pct:"التضخّم", unemployment_pct:"البطالة", population:"عدد السكان",
  current_account_pct_gdp:"الحساب الجاري (٪)", exports_usd:"الصادرات", imports_usd:"الواردات",
  fdi_inflow_usd:"الاستثمار الأجنبي", govt_debt_pct_gdp:"الدين الحكومي (٪)", sovereign_credit_rating:"التصنيف الائتماني",
  competitiveness_rank:"ترتيب التنافسية", trade_agreements:"الاتفاقيات التجارية", gdp_by_sector:"الناتج حسب القطاع",
  agriculture_pct_gdp:"الزراعة (٪)", industry_pct_gdp:"الصناعة (٪)", services_pct_gdp:"الخدمات (٪)",
  renewable_energy_consumption_pct:"استهلاك الطاقة المتجددة", renewable_electricity_output_pct:"الكهرباء المتجددة",
  electric_power_consumption_pc:"استهلاك الكهرباء للفرد", access_to_electricity_pct:"الوصول للكهرباء",
  electricity_mix:"مزيج الكهرباء", installed_renewable_capacity:"القدرة المتجددة المركبة",
  oil_gas_reserves:"احتياطيات النفط والغاز", energy_renewable_target:"هدف الطاقة المتجددة", hydrogen_strategy:"استراتيجية الهيدروجين",
  major_energy_projects:"مشاريع الطاقة الكبرى", national_energy_players:"شركات الطاقة الوطنية",
  logistics_performance_index:"مؤشر الأداء اللوجستي", internet_users_pct:"مستخدمو الإنترنت",
  mobile_subscriptions_per100:"اشتراكات الهاتف", urban_population_pct:"سكان الحضر",
  major_ports:"الموانئ الرئيسية", major_airports:"المطارات الرئيسية", infrastructure_project_pipeline:"مشاريع البنية التحتية",
  rail_road_networks:"شبكات السكك والطرق", digital_infrastructure_5g:"البنية الرقمية / الجيل الخامس", ppp_landscape:"الشراكة بين القطاعين",
  co2_emissions_per_capita:"انبعاثات الكربون للفرد", net_zero_target:"هدف الحياد الكربوني", climate_commitments_ndc:"الالتزامات المناخية",
  environmental_performance_index:"مؤشر الأداء البيئي", green_finance_initiatives:"التمويل الأخضر",
  rd_spend_pct_gdp:"الإنفاق على البحث والتطوير", global_innovation_index_rank:"ترتيب الابتكار العالمي",
  smart_city_initiatives:"مبادرات المدن الذكية", digital_government_maturity:"نضج الحكومة الرقمية", tech_ecosystem_highlights:"منظومة التقنية",
  uae_bilateral_agreements:"اتفاقيات مع الإمارات", uae_bilateral_trade:"التجارة مع الإمارات", uae_companies_present:"شركات إماراتية",
  uae_joint_ventures:"مشاريع مشتركة مع الإمارات", uae_cooperation_areas:"مجالات التعاون", uae_diplomatic_status:"الوضع الدبلوماسي",
  uae_ambassadors:"السفراء (الإمارات ↔)", uae_embassy_presence:"السفارات والقنصليات", uae_investments:"الاستثمارات الإماراتية",
  uae_recent_visits:"الزيارات الرفيعة الأخيرة",
  recent_developments:"المستجدات", upcoming_events:"الأحداث القادمة", recent_energy_infra_announcements:"إعلانات الطاقة والبنية",
  top_export_partners:"أهم شركاء التصدير", top_import_partners:"أهم شركاء الاستيراد", top_exports:"أهم الصادرات", top_imports:"أهم الواردات",
  momentum_sectors:"القطاعات الصاعدة", structural_shift:"التحوّل الهيكلي",
});
const DOMAINS = { en:{identity:"Identity & Governance",economy:"Economy & Trade",energy:"Energy",infrastructure:"Infrastructure & Transport",sustainability:"Sustainability & Climate",innovation:"Innovation & Smart Cities",uae_relations:"UAE Relationship",news:"Real-time / Events"},
 ar:{identity:"الهوية والحوكمة",economy:"الاقتصاد والتجارة",energy:"الطاقة",infrastructure:"البنية التحتية والنقل",sustainability:"الاستدامة والمناخ",innovation:"الابتكار والمدن الذكية",uae_relations:"العلاقة مع الإمارات",news:"الزمن الحقيقي"} };
const SOURCES_AR = { "World Bank Open Data":"البنك الدولي", "REST Countries":"REST Countries" };
const DOMAIN_ORDER = ["identity","economy","energy","infrastructure","sustainability","innovation","uae_relations","news"];
const KPIS = ["gdp_nominal_usd","gdp_per_capita_usd","gdp_growth_pct","population","inflation_pct","renewable_energy_consumption_pct"];

const $ = (s) => document.querySelector(s);
const pretty = (n) => (LABELS[LANG][n] || LABELS.en[n] || n.replace(/_/g," ").replace(/\b\w/g,(c)=>c.toUpperCase()));
const domLabel = (d) => DOMAINS[LANG][d] || DOMAINS.en[d] || d;
function srcName(s){ if(!s) return ""; if(s.startsWith("MANUAL")) return LANG==="ar"?"تعديل يدوي"+s.slice(6):s; return LANG==="ar"?(SOURCES_AR[s]||s):s; }
function escapeHtml(s){ return (s||"").replace(/[&<>]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }
function fmt(value,unit){ if(value===null||value===undefined) return "—"; const n=Number(value);
  if(!isNaN(n)&&unit==="USD"){ if(Math.abs(n)>=1e12) return "$"+(n/1e12).toFixed(2)+"T"; if(Math.abs(n)>=1e9) return "$"+(n/1e9).toFixed(1)+"B"; if(Math.abs(n)>=1e6) return "$"+(n/1e6).toFixed(1)+"M"; return "$"+Math.round(n).toLocaleString(); }
  if(!isNaN(n)&&unit==="%") return n.toFixed(1)+"%"; if(!isNaN(n)&&unit==="people") return Math.round(n).toLocaleString();
  if(!isNaN(n)){ const r=Math.round(n*10)/10; return r.toLocaleString()+(unit?" "+unit:""); }
  return value+(unit?" "+unit:""); }
function stripCites(s){ return (s||"")
  .replace(/\s*\(\s*\[[^\]]*\]\([^)]*\)\s*\)/g,"")
  .replace(/\s*\[[^\]]*\]\((https?:[^)]*)\)/g,"")
  .replace(/\s*\(\s*https?:\/\/[^)]*\)/g,"")
  .replace(/\?utm_source=openai/g,"")
  .replace(/[ \t]{2,}/g," ").trim(); }
function mdToHtml(text){ let s=stripCites(String(text||"")); s=escapeHtml(s);
  s=s.replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/(?:^|\n)\s*[-•]\s+/g,"\n• ");
  const lines=s.split(/\n+/).map(l=>l.trim()).filter(Boolean);
  return lines.map(l=>/^(\d+\.|•)\s/.test(l)?`<div class="li">${l}</div>`:`<p>${l}</p>`).join(""); }

// ── user log helper: every admin action is audited ──
function logUser(action, detail, iso3){
  try{ fetch("/logs/user",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({actor:USER,action,detail:detail||"",country_iso:iso3||null})}); }catch(e){}
}

// ════════ language + navigation ════════
function setLang(l){
  LANG=l; document.documentElement.lang=l; document.body.dir=l==="ar"?"rtl":"ltr";
  $("#lang-en").classList.toggle("active",l==="en"); $("#lang-ar").classList.toggle("active",l==="ar");
  const t=I18N[l];
  const M={"t-title":"title","t-sub":"sub","nav-home":"nav_home","nav-chat":"nav_chat","nav-briefings":"nav_briefings",
    "nav-compare":"nav_compare","nav-sources":"nav_sources","nav-params":"nav_params","nav-logs":"nav_logs",
    "t-home-h":"home_h","t-home-p":"home_p","t-home-brief":"home_brief","t-home-ask":"home_ask","t-news-h":"news_h",
    "t-home-recent":"home_recent","t-chath":"chath","t-chatp":"chatp","t-chip-last":"chip_last","t-chip-cmp":"chip_cmp",
    "t-chip-opp":"chip_opp","t-chip-nz":"chip_nz","t-br-h":"br_h","t-br-p":"br_p","buildbtn":"br_open","t-br-lib":"br_lib",
    "t-prog":"prog","t-cmp-h":"cmp_h","t-cmp-p":"cmp_p","cmp-btn":"cmp_btn","t-src-h":"src_h","t-src-p":"src_p",
    "src-add-btn":"src_add","t-keys-h":"keys_h","t-keys-p":"keys_p","t-keys-add":"keys_add","t-int-h":"int_h",
    "t-int-p":"int_p","t-int-iso":"int_iso","t-int-add":"int_add","t-par-h":"par_h","t-par-p":"par_p",
    "t-log-h":"log_h","t-log-p":"log_p","lt-agent":"log_ai","lt-user":"log_user","lt-all":"log_all"};
  Object.entries(M).forEach(([id,key])=>{ const el=document.getElementById(id); if(el&&t[key]) el.textContent=t[key]; });
  const ph={"home-input":"home_ph","chat-hero-input":"chat_ph","chat-input":"chat_ph","country":"placeholder"};
  Object.entries(ph).forEach(([id,key])=>{ const el=document.getElementById(id); if(el&&t[key]) el.placeholder=t[key]; });
  if($("#sec-home").classList.contains("active")){ loadHome(); }
  if($("#sec-sources").classList.contains("active")){ loadSources(); loadKeys(); loadInternal(); }
  if($("#sec-params").classList.contains("active")) loadParams();
  if($("#sec-briefing").classList.contains("active")&&CURRENT){ renderWSHead(CURRENT); renderTabs(); renderTab(WS_TAB); }
}
const SECTIONS=["home","chat","briefings","briefing","compare","sources","params","logs"];
function showSection(name){
  SECTIONS.forEach((s)=>{ const sec=$("#sec-"+s); if(sec) sec.classList.toggle("active",s===name);
    const nb=$("#nav-"+s); if(nb) nb.classList.toggle("active",s===name||(name==="briefing"&&s==="briefings")); });
  if(name==="home"){ loadHome(); loadNews(); }
  if(name==="briefings") loadBriefings();
  if(name==="sources"){ loadSources(); loadKeys(); loadInternal(); }
  if(name==="params") loadParams();
  if(name==="logs") loadLogs("agent");
}

// ════════ HOME ════════
function homeGo(mode){
  const v=($("#home-input").value||"").trim(); if(!v) return;
  if(mode==="brief"){ openBriefing(v); }
  else { showSection("chat"); chatQuick(v); }
}
let NEWS_Q="UAE Central Asia energy infrastructure";
async function loadNews(q){
  if(q) NEWS_Q=q;
  const host=$("#news-list"); host.innerHTML=`<p class="note">${I18N[LANG].thinking}</p>`;
  try{
    const r=await fetch(`/news?q=${encodeURIComponent(NEWS_Q)}`); const d=await r.json();
    $("#news-live").innerHTML=d.live?`<span class="livebadge">● ${I18N[LANG].live}</span>`:`<span class="livebadge" style="background:#F6E7E1;color:var(--brick)">${I18N[LANG].offline}</span>`;
    host.innerHTML=(d.items||[]).map(it=>{
      const dt=it.published?new Date(it.published):null;
      const when=dt&&!isNaN(dt)?dt.toLocaleDateString(LANG==="ar"?"ar-AE":"en-GB",{day:"numeric",month:"short"}):"";
      return `<div class="newsitem"><span class="dot">●</span><a href="${it.link}" target="_blank" rel="noopener">${escapeHtml(it.title)}</a><span class="m">${escapeHtml(it.source||"")}${when?" · "+when:""}</span></div>`;
    }).join("")||`<p class="note">—</p>`;
  }catch(e){ host.innerHTML=`<p class="note" style="color:var(--brick)">${e}</p>`; }
}
async function loadHome(){
  try{
    const r=await fetch("/library"); const d=await r.json(); const cs=d.countries||[]; const t=I18N[LANG];
    const facts=cs.reduce((a,c)=>a+(c.found||0),0);
    $("#home-stats").innerHTML=[[cs.length,t.stat_countries],[facts.toLocaleString(),t.stat_facts],["8",t.stat_domains],["0",t.stat_nohall]]
      .map(([v,l])=>`<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("");
    if(!cs.length){ $("#home-recent").innerHTML=`<p class="note">${LANG==="ar"?"لا توجد ملفات بعد — أنشئ أول دولة من الأعلى.":"No dossiers yet — build your first country above."}</p>`; return; }
    $("#home-recent").innerHTML=`<div class="libgrid">`+cs.slice(0,12).map(c=>{
      const pct=c.total?Math.round((c.found/c.total)*100):0; const nm=(c.name||"").replace(/'/g,"");
      return `<div class="libcard" onclick="openBriefing('${nm}')"><div class="n">${c.name||c.country_iso} <span class="yr">${c.country_iso}</span></div><div class="barmini"><div style="width:${pct}%"></div></div><div class="m">${pct}% · ${(c.updated_at||"").slice(0,16).replace("T"," ")}</div></div>`;
    }).join("")+`</div>`;
  }catch(e){ $("#home-recent").innerHTML=`<p class="note" style="color:var(--brick)">${e}</p>`; }
}

// ════════ BRIEFINGS list ════════
async function loadBriefings(){
  const host=$("#briefings-grid"); host.innerHTML=`<p class="note">…</p>`;
  try{
    const r=await fetch("/library"); const d=await r.json(); const cs=d.countries||[];
    if(!cs.length){ host.innerHTML=`<p class="note">${LANG==="ar"?"المكتبة فارغة.":"Library is empty — build your first briefing above."}</p>`; return; }
    host.innerHTML=`<div class="libgrid">`+cs.map(c=>{
      const pct=c.total?Math.round((c.found/c.total)*100):0; const nm=(c.name||"").replace(/'/g,"");
      return `<div class="libcard" onclick="openBriefing('${nm}')"><div class="n">${c.name||c.country_iso} <span class="yr">${c.country_iso}</span></div><div class="barmini"><div style="width:${pct}%"></div></div><div class="m">${pct}% · ${(c.updated_at||"").slice(0,16).replace("T"," ")}</div></div>`;
    }).join("")+`</div>`;
  }catch(e){ host.innerHTML=`<p class="note" style="color:var(--brick)">${e}</p>`; }
}

// ════════ BRIEFING WORKSPACE ════════
const WS_TABS=[["progress","tab_progress"],["briefing","tab_briefing"],["uae","tab_uae"],["opps","tab_opps"],
  ["pred","tab_pred"],["talk","tab_talk"],["council","tab_council"],["identity","tab_identity"],
  ["economy","tab_economy"],["energy","tab_energy"],["lab","tab_lab"]];

async function openBriefing(c){
  const country=(c||$("#country").value||"").trim(); if(!country) return;
  showSection("briefing"); WS_TAB="progress";
  $("#ws-head").innerHTML=`<div class="card"><h2>${escapeHtml(country)}</h2><p class="note">${I18N[LANG].thinking}</p></div>`;
  renderTabs(); $("#stages").innerHTML=""; $("#ws-memory").innerHTML=""; $("#ws-pane").innerHTML="";
  logUser("open_briefing", `Opened briefing workspace for ${country}.`);
  try{
    const r=await fetch(`/dossier/${encodeURIComponent(country)}/full?lang=${LANG}`);
    if(r.ok){ CURRENT=await r.json(); renderWSHead(CURRENT); WS_TAB="briefing"; renderTabs(); renderTab("briefing"); loadRunMemory(country); return; }
  }catch(e){}
  startBuild(country,false);
}
function renderTabs(){
  $("#ws-tabs").innerHTML=WS_TABS.map(([id,key])=>`<button id="wt-${id}" class="${WS_TAB===id?'active':''}" onclick="renderTab('${id}')">${I18N[LANG][key]}</button>`).join("");
}
function renderWSHead(ev){
  const t=I18N[LANG]; const pct=Math.round((ev.coverage||0)*100);
  const C=encodeURIComponent(ev.country); const L=LANG;
  $("#ws-head").innerHTML=`<div class="card" style="padding:18px 24px"><div class="dosshead">
    <h2>${ev.country} <span class="iso">${ev.iso3}</span></h2>
    <span class="goodtag">${t.ts_tag}</span>
    <div class="exports">
      <button class="chip" style="cursor:pointer" onclick="startBuild('${ev.country.replace(/'/g,"")}',true)">${t.refresh}</button>
      <button class="chip" style="cursor:pointer" onclick="checkUpdates('${ev.country.replace(/'/g,"")}')">🔔 ${t.updates}</button>
    </div>
    <div class="covwrap"><div class="covbar"><div style="width:${pct}%"></div></div>
      <div class="covlabel">${pct}% ${t.coverage} · ${ev.found}/${ev.expected} ${t.fields}</div></div></div>
    <div id="updbox"></div></div>`;
}
function startBuild(country,refresh=false){
  WS_TAB="progress"; renderTabs(); renderTab("progress");
  $("#stages").innerHTML=""; $("#ws-memory").innerHTML="";
  logUser(refresh?"rebuild":"build", `${refresh?"Re-researched":"Built"} briefing for ${country}.`);
  let finished=false;
  const addStage=(ev,isErr)=>{ const li=document.createElement("li"); const c=isErr?' style="color:var(--brick)"':""; li.innerHTML=`<b${c}>${ev.stage}</b> · ${escapeHtml(ev.msg||"")}`; $("#stages").appendChild(li); li.scrollIntoView({block:"nearest"}); };
  const es=new EventSource(`/dossier/${encodeURIComponent(country)}/stream?lang=${LANG}&refresh=${refresh}`);
  es.onmessage=(e)=>{ let ev; try{ev=JSON.parse(e.data)}catch{return}
    if(ev.run_id&&!CURRENT_RUN) CURRENT_RUN=ev.run_id;
    if(ev.stage==="start"){ CURRENT_RUN=ev.run_id; pollMemory(); return; }
    if(ev.stage==="done"){ finished=true; es.close(); stopMemoryPoll(); CURRENT=ev; CURRENT_RUN=ev.run_id||CURRENT_RUN;
      renderWSHead(ev); fetchMemoryOnce(); addStage({stage:"done",msg:"Briefing ready — opening it now."});
      setTimeout(()=>{ WS_TAB="briefing"; renderTabs(); renderTab("briefing"); },900); }
    else if(ev.stage==="error"){ finished=true; es.close(); stopMemoryPoll(); addStage(ev,true); }
    else addStage(ev, ev.stage==="warn"); };
  es.onerror=()=>{ if(finished) return; finished=true; es.close(); stopMemoryPoll(); addStage({stage:"error",msg:"connection lost — check the server window."},true); };
}
function pollMemory(){ stopMemoryPoll(); MEM_TIMER=setInterval(fetchMemoryOnce, 4000); }
function stopMemoryPoll(){ if(MEM_TIMER){ clearInterval(MEM_TIMER); MEM_TIMER=null; } }
const AGENT_ICONS={"orchestrator":"🧭","verifier":"✅","analyst":"📈","predictive":"🔮","council":"🏛","writer":"✍","visualizer":"🎬",
  "Identity & Governance":"🏛","Economy & Trade":"💹","Energy":"⚡","Infrastructure & Transport":"🚆",
  "Sustainability & Climate":"🌱","Innovation & Smart Cities":"💡","UAE Relationship":"🇦🇪","Real-time / Events":"📰"};
async function fetchMemoryOnce(){
  if(!CURRENT_RUN) return;
  try{
    const r=await fetch(`/memory?run_id=${encodeURIComponent(CURRENT_RUN)}`); const d=await r.json();
    const notes=d.notes||[]; if(!notes.length) return;
    const byAgent={}; notes.forEach(n=>{ (byAgent[n.agent]=byAgent[n.agent]||[]).push(n); });
    $("#ws-memory").innerHTML=`<h3 class="domain">${I18N[LANG].memory_h}</h3><div class="agentgrid">`+
      Object.entries(byAgent).map(([agent,ns])=>{
        const last=ns[ns.length-1];
        return `<div class="memocard"><div class="a">${AGENT_ICONS[agent]||"🤖"} ${escapeHtml(agent)}</div>${escapeHtml(last.note)}<div class="t">${(last.created_at||"").slice(11,19)} · ${ns.length} note${ns.length>1?"s":""}</div></div>`;
      }).join("")+`</div>`;
  }catch(e){}
}
async function loadRunMemory(country){
  // last run's memory for a cached briefing
  try{
    const r=await fetch(`/runs?country=${encodeURIComponent(CURRENT?CURRENT.iso3:"")}&limit=1`); const d=await r.json();
    if(d.runs&&d.runs.length){ CURRENT_RUN=d.runs[0].run_id; fetchMemoryOnce(); loadRunLog(); }
  }catch(e){}
}
async function loadRunLog(){
  if(!CURRENT_RUN) return;
  try{
    const r=await fetch(`/logs?run_id=${encodeURIComponent(CURRENT_RUN)}&limit=100`); const d=await r.json();
    const evs=(d.events||[]).slice().reverse();
    $("#stages").innerHTML=evs.map(e=>`<li><b>${escapeHtml(e.actor)}</b> · ${escapeHtml(e.action)} — ${escapeHtml(e.detail||"")}</li>`).join("");
  }catch(e){}
}
function renderTab(tab){
  WS_TAB=tab;
  WS_TABS.forEach(([id])=>{ const b=$("#wt-"+id); if(b) b.classList.toggle("active",id===tab); });
  const prog=$("#ws-progress"), pane=$("#ws-pane");
  if(tab==="progress"){ prog.classList.remove("hidden"); pane.innerHTML=""; if(CURRENT&&!$("#stages").children.length) loadRunLog(); return; }
  prog.classList.add("hidden");
  if(!CURRENT){ pane.innerHTML=`<div class="card"><p class="note">${LANG==="ar"?"لا بيانات بعد — شغّل الإحاطة أولًا.":"No data yet — run the briefing first."}</p></div>`; return; }
  const t=I18N[LANG]; const ev=CURRENT;
  if(tab==="briefing"){
    const deep=[["summary",t.summary],["talking_points",t.tp]].map(([k,h])=>ev[k]?`<h3 class="domain">${h}</h3><div class="summary">${escapeHtml(ev[k])}</div>`:"").join("");
    pane.innerHTML=`<div class="card">${renderTearsheet(ev)}${deep}
      <div style="margin-top:14px"><button class="chip" style="cursor:pointer" onclick="document.getElementById('fulldata').classList.toggle('hidden')">${t.fulldata} ▾</button>
      <div id="fulldata" class="hidden" style="margin-top:12px">${domainTables(ev,DOMAIN_ORDER)}</div></div></div>`;
  }
  else if(tab==="uae"){ pane.innerHTML=renderUAE(ev); }
  else if(tab==="opps"){ pane.innerHTML=`<div class="card"><h2>${t.analysis}</h2>${ev.analysis?`<div class="summary">${escapeHtml(ev.analysis)}</div>`:`<p class="note">${t.na}</p>`}</div>`; }
  else if(tab==="pred"){ pane.innerHTML=`<div class="card"><h2>${t.predictive}</h2>${ev.predictive?`<div class="summary">${escapeHtml(ev.predictive)}</div>`:`<p class="note">${t.na}</p>`}</div>`; }
  else if(tab==="talk"){ pane.innerHTML=`<div class="card"><h2>${t.tp}</h2>${ev.talking_points?`<div class="summary">${escapeHtml(ev.talking_points)}</div>`:`<p class="note">${t.na}</p>`}</div>`; }
  else if(tab==="council"){ pane.innerHTML=renderCouncil(ev); }
  else if(tab==="identity"){ pane.innerHTML=`<div class="card"><h2>${domLabel("identity")}</h2>${domainTables(ev,["identity"])}</div>`; }
  else if(tab==="economy"){ pane.innerHTML=`<div class="card"><h2>${domLabel("economy")}</h2>${tradeSection(ev)}${domainTables(ev,["economy"])}</div>`; }
  else if(tab==="energy"){ pane.innerHTML=`<div class="card"><h2>${t.tab_energy.replace(/^⚡ /,"")}</h2>${domainTables(ev,["energy","infrastructure","sustainability","innovation","news"])}</div>`; }
  else if(tab==="lab"){ pane.innerHTML=renderLab(ev); }
}
function tradeSection(ev){
  const t=I18N[LANG]; const trade=ev.trade;
  if(!trade||!(trade.export_partners||trade.import_partners)) return "";
  const yr=trade.year?`<span class="iso">· ${trade.year} ${t.tradeyear}</span>`:"";
  return `${sectionHead(t.trade_sectors+" "+yr)}<div class="ts-grid">
    <div class="ts-panel"><h4>${t.exP}</h4>${tradeBars(trade.export_partners)}</div>
    <div class="ts-panel"><h4>${t.imP}</h4>${tradeBars(trade.import_partners)}</div>
    <div class="ts-panel"><h4>${t.exG}</h4>${tradeBars(trade.export_goods)}</div>
    <div class="ts-panel"><h4>${t.imG}</h4>${tradeBars(trade.import_goods)}</div></div>`;
}
function renderUAE(ev){
  const t=I18N[LANG]; const f=ev.fields||{};
  const groups=[[t.amb,["uae_ambassadors","uae_embassy_presence","uae_diplomatic_status"]],
    [t.inv,["uae_investments","uae_companies_present","uae_joint_ventures","uae_bilateral_trade"]],
    [t.agr,["uae_bilateral_agreements","trade_agreements"]],
    [t.coop,["uae_cooperation_areas","uae_recent_visits"]]];
  const cards=groups.map(([h,keys])=>{
    const facts=keys.map(k=>tsFact(f,k,420)).filter(Boolean).join("");
    return `<div class="ts-panel"><h4>${h}</h4>${facts||`<p class="note">${t.notfoundval}</p>`}</div>`;
  }).join("");
  return `<div class="card"><h2>${t.uae_h}</h2><p class="lead">${t.uae_p}</p><div class="ts-grid">${cards}</div></div>`;
}
function renderCouncil(ev){
  const t=I18N[LANG];
  if(!ev.council) return `<div class="card"><h2>${t.council_h}</h2><p class="lead">${t.council_p}</p><p class="note">${t.na}</p></div>`;
  const SEAT_KEYS=[["ECONOMIST","💹"],["ENERGY & INFRA STRATEGIST","⚡"],["GEOPOLITICAL ADVISOR","🌍"],["RISK OFFICER","🛡"]];
  const text=ev.council; const lines=text.split(/\n+/);
  const seats=[]; let verdict="", confidence="", dissent="";
  let cur=null;
  lines.forEach(l=>{
    const u=l.trim(); const upper=u.toUpperCase();
    const seat=SEAT_KEYS.find(([k])=>upper.startsWith(k));
    if(seat){ cur={name:seat[0],icon:seat[1],body:u.slice(u.indexOf(":")+1).trim()}; seats.push(cur); }
    else if(upper.startsWith("VERDICT")){ cur=null; verdict=u.slice(u.indexOf(":")+1).trim(); }
    else if(upper.startsWith("CONFIDENCE")){ cur=null; confidence=u.slice(u.indexOf(":")+1).trim(); }
    else if(upper.startsWith("DISSENT")){ cur=null; dissent=u.slice(u.indexOf(":")+1).trim(); }
    else if(cur){ cur.body+=" "+u; }
    else if(verdict&&!confidence){ verdict+=" "+u; }
  });
  const seatCards=seats.map(s=>`<div class="seat"><h4>${s.icon} ${escapeHtml(s.name)}</h4>${escapeHtml(s.body)}</div>`).join("");
  const conf=confidence?`<div class="goodtag" style="font-size:13px;margin-top:10px">🎯 ${escapeHtml(confidence)}</div>`:"";
  const dis=dissent&&dissent.toLowerCase()!=="none"?`<div class="dash-panel risk" style="margin-top:12px"><h4>${LANG==="ar"?"رأي مخالف":"Dissent"}</h4>${escapeHtml(dissent)}</div>`:"";
  return `<div class="card"><h2>${t.council_h}</h2><p class="lead">${t.council_p}</p>
    ${seats.length?`<div class="seatgrid">${seatCards}</div>`:""}
    ${verdict?`<div class="verdict"><b>${t.verdict}:</b>\n${escapeHtml(verdict)}</div>`:`<div class="summary">${escapeHtml(text)}</div>`}
    ${conf}${dis}</div>`;
}
const LAB_SECTIONS=[["read","Executive read"],["kpis","Key indicators"],["trade","Trade & sectors"],["uae","UAE angle"],["snapshot","At a glance"]];
function renderLab(ev){
  const t=I18N[LANG]; const C=encodeURIComponent(ev.country); const L=LANG;
  const cards=[
    ["📽",t.lab_ppt,t.lab_ppt_d,`labExport('pptx','/dossier/${C}/export.pptx?lang=${L}')`],
    ["📄",t.lab_pdf,t.lab_pdf_d,`labExport('pdf','/dossier/${C}/export.pdf?lang=${L}')`],
    ["📊",t.lab_dash,t.lab_dash_d,`labDashboard()`],
    ["🖼",t.lab_svg,t.lab_svg_d,`labExport('onepager','/dossier/${C}/infographic.svg?lang=${L}','_blank')`],
    ["📑",t.lab_xls,t.lab_xls_d,`labExport('xlsx','/dossier/${C}/export.xlsx?lang=${L}')`],
    ["🖨",t.lab_print,t.lab_print_d,`labPrint()`],
  ].map(([ic,nm,ds,fn])=>`<div class="labcard" onclick="${fn}"><div class="ic">${ic}</div><div class="nm">${nm}</div><div class="ds">${ds}</div></div>`).join("");
  const opts=LAB_SECTIONS.map(([id,lab])=>`<label><input type="checkbox" id="lab-${id}" checked> ${lab}</label>`).join("");
  return `<div class="card"><h2>${t.lab_h}</h2><p class="lead">${t.lab_p}</p>
    <div class="labgrid">${cards}</div>
    <h3 class="domain">${LANG==="ar"?"أقسام الطباعة / الصفحة الواحدة":"Sections for print / one-pager"}</h3>
    <div class="labopts">${opts}</div>
    <div id="lab-stage" style="margin-top:14px"></div></div>`;
}
function labExport(kind,url,target){
  logUser("export", `Exported ${kind} for ${CURRENT?CURRENT.country:"?"}.`, CURRENT?CURRENT.iso3:null);
  if(target) window.open(url,target); else window.location=url;
}
function labDashboard(){
  logUser("export","Opened live dashboard view.",CURRENT?CURRENT.iso3:null);
  const host=$("#lab-stage"); host.innerHTML=`<div id="view-dash"></div>`;
  renderDashboard(CURRENT,host.querySelector("#view-dash"));
}
function labPrint(){
  const on=(id)=>{ const el=$("#lab-"+id); return el?el.checked:true; };
  const ev=CURRENT; const t=I18N[LANG];
  let html="";
  if(on("read")) html+=`<div class="ts-read" style="margin-bottom:14px">${escapeHtml((ev.tearsheet&&ev.tearsheet.read)||ev.summary||"")}</div>`;
  if(on("kpis")){ const k=KPIS.filter(k=>ev.fields[k]&&ev.fields[k].found).map(k=>{ const f=ev.fields[k];
    return `<div class="kpi"><div class="v">${fmt(f.value,f.unit)}</div><div class="l">${pretty(k)}</div><div class="s">${srcName(f.source)}</div></div>`; }).join("");
    html+=`<div class="kpis">${k}</div>`; }
  if(on("trade")) html+=tradeSection(ev);
  if(on("uae")){ const u=["uae_investments","uae_bilateral_trade","uae_bilateral_agreements","uae_ambassadors"].map(k=>tsFact(ev.fields,k,300)).join("");
    if(u) html+=`${sectionHead(t.uaesnap)}<div class="ts-grid"><div class="ts-panel">${u}</div></div>`; }
  if(on("snapshot")){ const s=["official_name","capital","head_of_state","head_of_government","sovereign_credit_rating","national_vision_strategy"].map(k=>tsFact(ev.fields,k,160)).join("");
    if(s) html+=`${sectionHead(t.snapshot)}<div class="ts-grid"><div class="ts-panel">${s}</div></div>`; }
  const host=$("#lab-stage");
  host.innerHTML=`<div class="card" id="print-zone"><div class="dosshead"><h2>${ev.country} <span class="iso">${ev.iso3}</span></h2><span class="goodtag">${t.ts_tag}</span></div>${html}</div>`;
  logUser("export",`Printed custom one-pager for ${ev.country}.`,ev.iso3);
  setTimeout(()=>window.print(),300);
}
function domainTables(ev,domains){
  const t=I18N[LANG]; const fields=ev.fields||{};
  const byDomain={}; Object.entries(fields).forEach(([name,f])=>{ (byDomain[f.domain||"other"]=byDomain[f.domain||"other"]||[]).push([name,f]); });
  let tables="";
  domains.forEach((d)=>{ if(!byDomain[d]) return;
    const rows=byDomain[d].map(([name,f])=>{
      const corr=f.corroborated?`<span class="badge b-corr">${t.corr}</span>`:""; const man=(f.source||"").startsWith("MANUAL")?`<span class="badge b-manual">${t.manual}</span>`:"";
      const conf=f.found?`<span class="b-conf-${f.confidence}">●</span>`:"";
      const val=f.found?`<span class="val">${fmt(f.value,f.unit)}</span> ${conf} ${corr} ${man}`:`<span style="color:var(--brick)">${t.notfoundval}</span>`;
      const link=f.source_url?` · <a href="${f.source_url}" target="_blank" style="color:var(--gold)">↗</a>`:"";
      const src=f.found?`<div class="src">${srcName(f.source)}${f.as_of?" · "+f.as_of:""}${link}</div>`:"";
      return `<tr><td>${pretty(name)}</td><td>${val}${src}</td><td class="rowbtns" style="text-align:end;white-space:nowrap"><button onclick="showHistory('${ev.country}','${name}')">${t.history}</button><button onclick="showEdit('${ev.country}','${name}')">${t.edit}</button></td></tr>`;
    }).join("");
    tables+=`<h3 class="domain">${domLabel(d)}</h3><table><tr><th>${t.field}</th><th>${t.value} / ${t.source}</th><th></th></tr>${rows}</table>`; });
  const nf=(ev.not_found||[]).filter(n=>{ const f=fields[n]; return !f||domains.includes(f.domain); });
  return tables+(nf.length&&domains.length>2?`<div class="notfound"><b>${t.notfound}:</b> ${nf.map(pretty).join("، ")}</div>`:"");
}

// ════════ tear sheet (reused) ════════
function spark(arr, goodUp){
  if(!arr||arr.length<2) return "";
  const w=84,h=24,mn=Math.min(...arr),mx=Math.max(...arr),rng=(mx-mn)||1;
  const pts=arr.map((v,i)=>`${(i/(arr.length-1)*w).toFixed(1)},${(h-2-((v-mn)/rng)*(h-4)).toFixed(1)}`).join(" ");
  const rising=arr[arr.length-1]>=arr[0];
  const col=(rising===!!goodUp)?"var(--teal)":"var(--brick)";
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="vertical-align:middle"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.6"/></svg>`;
}
function trendBadge(tr){
  if(!tr) return "";
  const up=tr.direction==="up", down=tr.direction==="down";
  const arrow=up?"▲":(down?"▼":"—");
  const chg=(tr.unit==="%")?((tr.delta_pp>0?"+":"")+tr.delta_pp+" pp"):((tr.change_pct>0?"+":"")+(tr.change_pct||0)+"%");
  const good=(up===!!tr.good_up)||tr.direction==="flat";
  return `<span style="color:${good?"var(--teal)":"var(--brick)"};font-weight:700">${arrow} ${chg}</span> <span class="yr">/${tr.span_years}y</span>`;
}
function tradeBars(items){
  if(!items||!items.length) return `<div class="note">${I18N[LANG].notfoundval}</div>`;
  const mx=Math.max(...items.map(i=>i.share_pct||0))||1;
  return items.map(i=>{
    const w=Math.max(6,Math.round((i.share_pct||0)/mx*100));
    const val=usdShort(i.value);
    return `<div class="tradebar"><div class="row"><b>${escapeHtml(i.name||"")}</b><span class="v">${(i.share_pct!=null?i.share_pct+"%":"")}${val?" · "+val:""}</span></div><div class="track"><div style="width:${w}%"></div></div></div>`;
  }).join("");
}
function usdShort(n){ n=Number(n); if(!isFinite(n)||!n) return ""; if(Math.abs(n)>=1e12)return"$"+(n/1e12).toFixed(2)+"T"; if(Math.abs(n)>=1e9)return"$"+(n/1e9).toFixed(1)+"B"; if(Math.abs(n)>=1e6)return"$"+(n/1e6).toFixed(0)+"M"; return"$"+n.toLocaleString(); }
function tsFact(fields,key,clip){ const f=fields[key]; if(!f||!f.found) return ""; let v=escapeHtml(String(f.value)); if(clip&&v.length>clip)v=v.slice(0,clip)+"…";
  const link=f.source_url?` <a href="${f.source_url}" target="_blank" style="color:var(--gold)">↗</a>`:"";
  return `<div class="ts-fact"><span class="k">${pretty(key)}:</span> ${v}<div class="s">${srcName(f.source)||""}${f.as_of?" · "+f.as_of:""}${link}</div></div>`; }
function sectionHead(label){ return `<div class="ts-sectionhead"><h3>${label}</h3><div class="ln"></div></div>`; }

function renderTearsheet(ev){
  const t=I18N[LANG]; const fields=ev.fields||{}; const trends=ev.trends||{}; const trade=ev.trade||null; const ts=ev.tearsheet||{};
  const read=ev.tearsheet&&ev.tearsheet.read?ev.tearsheet.read:(ev.summary||"");
  const readBlock=`<div class="ts-read">${read?escapeHtml(read):`<span class="note">${t.noread}</span>`}</div>`;
  const g=ts.gdp_per_capita_trend||trends.gdp_per_capita_usd?{...(trends.gdp_per_capita_usd||{}),...(ts.gdp_per_capita_trend||{})}:null;
  let traj="";
  if(g){ const cagr=g.cagr_pct!=null?g.cagr_pct:null; const up=(g.direction==="up");
    const disp=g.display||fmt(g.latest,"USD");
    traj=`<div class="ts-traj"><div class="lab">${t.gdppc}</div><div class="big">${disp}</div>`+
      `<div class="meta">${g.year||g.latest_year||""}</div>`+
      (cagr!=null?`<div class="move ${up?"up":"down"}">${up?"▲":"▼"} ${cagr}%/${LANG==="ar"?"سنة":"yr"} CAGR · ${g.span_years||5}${LANG==="ar"?" سنوات":"y"}</div>`:"")+
      `<div style="margin-top:8px">${spark(g.spark,true)}</div></div>`;
  }
  const hero=`<div class="ts-hero">${readBlock}${traj}</div>`;
  const kpiCards=KPIS.filter(k=>fields[k]&&fields[k].found).map(k=>{ const f=fields[k]; const tr=trends[k];
    return `<div class="kpi"><div class="v">${fmt(f.value,f.unit)}</div><div class="l">${pretty(k)}</div>`+
      (tr?`<div class="s">${trendBadge(tr)}</div><div>${spark(tr.spark,tr.good_up)}</div>`:"")+
      `<div class="s">${srcName(f.source)}${f.as_of?"، "+f.as_of:""}</div></div>`; }).join("");
  const kpiBlock=kpiCards?`${sectionHead(t.keyindicators)}<div class="kpis">${kpiCards}</div>`:"";
  let tradeBlock=tradeSection(ev);
  if(!tradeBlock){
    const tf=["top_export_partners","top_import_partners","top_exports","top_imports"].map(k=>tsFact(fields,k)).join("");
    if(tf) tradeBlock=`${sectionHead(t.trade_sectors)}<div class="ts-grid"><div class="ts-panel">${tf}</div></div>`;
  }
  const sector=["momentum_sectors","structural_shift","gdp_by_sector","competitiveness_rank","top_exports"].map(k=>tsFact(fields,k,260)).join("");
  const uae=["uae_bilateral_trade","uae_investments","uae_bilateral_agreements","uae_cooperation_areas"].map(k=>tsFact(fields,k,260)).join("");
  const grid2=(sector||uae)?`<div class="ts-grid" style="margin-top:6px">`+
    (sector?`<div class="ts-panel"><h4>${t.spotlight}</h4>${sector}</div>`:"")+
    (uae?`<div class="ts-panel"><h4>${t.uaesnap}</h4>${uae}</div>`:"")+`</div>`:"";
  const snap=["official_name","capital","head_of_state","head_of_government","sovereign_credit_rating","national_vision_strategy"].map(k=>tsFact(fields,k,160)).join("");
  const snapBlock=snap?`${sectionHead(t.snapshot)}<div class="ts-grid"><div class="ts-panel">${snap}</div></div>`:"";
  return hero+kpiBlock+tradeBlock+grid2+snapBlock;
}

// ════════ Dashboard renderer (Visualizer agent spec → visuals) ════════
const DPAL=["#9C7A2D","#2C7A6B","#B89A52","#A6492F","#C8A84B","#7A8C5A","#3D6E8C","#6F6A60"];
function parseShares(text){ if(!text) return []; const re=/([A-Za-z؀-ۿ][A-Za-z ؀-ۿ\/&-]*?)\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*%/g; const out=[],seen={}; let m;
  while((m=re.exec(String(text)))){ let name=m[1].trim().replace(/[\-:·,]+$/,'').trim(); const val=parseFloat(m[2]); if(!name||seen[name.toLowerCase()]||val<=0||val>100) continue; seen[name.toLowerCase()]=1; out.push({name,value:val}); }
  return out.length>=2?out:[]; }
function dRefField(ref){ const i=ref.indexOf(":"); return i<0?ref:ref.slice(i+1); }
function dResolve(ref,ev){ if(!ref) return null; const i=ref.indexOf(":"); const kind=i<0?"field":ref.slice(0,i); const key=i<0?ref:ref.slice(i+1);
  if(kind==="field"){ const f=(ev.fields||{})[key]; return (f&&f.found)?{type:"field",f,key}:null; }
  if(kind==="trend"){ const tr=(ev.trends||{})[key]; return (tr&&tr.spark&&tr.spark.length>1)?{type:"trend",key,tr}:null; }
  if(kind==="trade"){ if(key==="flows") return ev.trade?{type:"flows",trade:ev.trade}:null; const arr=(ev.trade||{})[key]; return (arr&&arr.length)?{type:"trade",key,arr}:null; }
  if(kind==="parse"){ const f=(ev.fields||{})[key]; const sh=(f&&f.found)?parseShares(f.value):[]; return sh.length?{type:"shares",shares:sh,key}:null; }
  if(kind==="text"){ const map={executive_summary:(ev.tearsheet&&ev.tearsheet.read)||ev.summary,analysis:ev.analysis,predictive:ev.predictive}; const v=map[key]; return v?{type:"text",text:v}:null; }
  return null; }
function dTitle(raw){ const known={export_composition:I18N[LANG].exG,trade_flows:I18N[LANG].trade_sectors,import_composition:I18N[LANG].imG}; if(known[raw]) return known[raw]; return pretty(raw); }
function fallbackBars(items,valKey){ const mx=Math.max(...items.map(i=>i[valKey]||i.value||0))||1;
  return `<div class="barlist">`+items.map((i,n)=>{ const v=i[valKey]!=null?i[valKey]:i.value; const w=Math.max(5,Math.round((v/mx)*100));
    return `<div class="r"><b>${escapeHtml(i.name)}</b><span class="yr">${i.share_pct!=null?i.share_pct+"%":fmt(i.value,"USD")}</span></div><div class="t"><div style="width:${w}%;background:${DPAL[n%DPAL.length]}"></div></div>`; }).join("")+`</div>`; }
function sankeySVG(trade){ const ex=(trade.export_partners||[]).slice(0,5), im=(trade.import_partners||[]).slice(0,5);
  const W=320,H=Math.max(160,(Math.max(ex.length,im.length))*34+20),cx=W/2,cyc=H/2;
  const maxS=Math.max(1,...ex.map(p=>p.share_pct||0),...im.map(p=>p.share_pct||0));
  let s=`<svg class="sankey" viewBox="0 0 ${W} ${H}" width="100%" height="${H}">`;
  s+=`<rect x="${cx-34}" y="${cyc-16}" width="68" height="32" rx="6" fill="#2B2B2B"/><text x="${cx}" y="${cyc+4}" text-anchor="middle" fill="#fff" font-weight="800">${escapeHtml(trade.iso3||(CURRENT&&CURRENT.iso3)||"")}</text>`;
  const draw=(arr,side)=>{ arr.forEach((p,n)=>{ const y=20+n*34; const x0=side<0?8:W-8; const xc=cx+side*34; const tw=Math.max(2,(p.share_pct||1)/maxS*11);
    const c=DPAL[n%DPAL.length]; const midx=(x0+xc)/2;
    s+=`<path d="M ${x0} ${y} C ${midx} ${y}, ${midx} ${cyc}, ${xc} ${cyc}" fill="none" stroke="${c}" stroke-width="${tw}" opacity=".55"/>`;
    s+=`<text x="${side<0?10:W-10}" y="${y-3}" text-anchor="${side<0?"start":"end"}">${escapeHtml(p.name)} ${p.share_pct!=null?p.share_pct+"%":""}</text>`; }); };
  draw(im,-1); draw(ex,1);
  s+=`<text x="10" y="${H-4}" font-size="9" fill="#6F6A60">${I18N[LANG].imP}</text><text x="${W-10}" y="${H-4}" text-anchor="end" font-size="9" fill="#6F6A60">${I18N[LANG].exP}</text>`;
  return s+`</svg>`; }
function treemap(items){ const tot=items.reduce((a,i)=>a+(i.value||i.share_pct||0),0)||1;
  return `<div class="tiles">`+items.slice(0,8).map((i,n)=>{ const v=i.value||i.share_pct||0; const pc=Math.round(v/tot*100); const fs=Math.max(54,pc*3.2);
    return `<div class="tile" style="flex:${Math.max(1,pc)};background:${DPAL[n%DPAL.length]};min-width:${fs}px"><span>${escapeHtml(i.name)}</span><span style="font-size:14px">${pc}%</span></div>`; }).join("")+`</div>`; }

function renderDashboard(ev,host){ const t=I18N[LANG]; const spec=ev.dashboard; host=host||$("#view-dash");
  if(!host) return;
  if(!spec){ host.innerHTML=`<div class="card"><span class="dash-na">${t.na}</span></div>`; return; }
  const HAS=!!window.Chart; const queue=[]; let uid=0;
  const kpis=(spec.kpis||[]).map(k=>{ const r=dResolve(k.source_field,ev); if(!r||r.type!=="field") return ""; const f=r.f; const tr=(ev.trends||{})[r.key];
    const badge=tr?`<div class="d ${(tr.direction==="up")===!!tr.good_up||tr.direction==="flat"?"up":"down"}">${trendBadge(tr)}</div>`:"";
    return `<div class="dash-kpi"><div class="v">${fmt(f.value,f.unit)}</div><div class="l">${dTitle(dRefField(k.source_field))}</div>${badge}</div>`; }).filter(Boolean).join("");
  const charts=(spec.charts||[]).map(c=>{ const ref=(c.source_fields||[])[0]; const r=dResolve(ref,ev); if(!r) return "";
    const id="dchart"+(uid++); const full=(c.chart_type==="sankey")?" full":""; let body="";
    if(c.chart_type==="line"&&r.type==="trend"){ const v=r.tr.spark, yrs=v.map((_,n)=>(r.tr.latest_year||0)-(v.length-1-n));
      if(HAS){ body=`<div class="dash-canvas-wrap"><canvas id="${id}"></canvas></div>`; queue.push({id,cfg:{type:"line",data:{labels:yrs,datasets:[{label:dTitle(dRefField(ref)),data:v,borderColor:DPAL[0],backgroundColor:"rgba(156,122,45,.12)",fill:true,tension:.3,pointRadius:2}]},options:dOpts(false)}}); }
      else body=spark(v,true); }
    else if(c.chart_type==="bar"&&r.type==="trade"){ const arr=r.arr.slice(0,6);
      if(HAS){ body=`<div class="dash-canvas-wrap"><canvas id="${id}"></canvas></div>`; queue.push({id,cfg:{type:"bar",data:{labels:arr.map(a=>a.name),datasets:[{label:"%",data:arr.map(a=>a.share_pct!=null?a.share_pct:a.value),backgroundColor:arr.map((_,n)=>DPAL[n%DPAL.length])}]},options:dOpts(false,true)}}); }
      else body=fallbackBars(arr,"share_pct"); }
    else if(c.chart_type==="donut"){ const items=r.type==="shares"?r.shares:(r.type==="trade"?r.arr.slice(0,6):null); if(!items) return "";
      if(HAS){ body=`<div class="dash-canvas-wrap"><canvas id="${id}"></canvas></div>`; queue.push({id,cfg:{type:"doughnut",data:{labels:items.map(a=>a.name),datasets:[{data:items.map(a=>a.share_pct!=null?a.share_pct:a.value),backgroundColor:items.map((_,n)=>DPAL[n%DPAL.length])}]},options:dOpts(true)}}); }
      else body=fallbackBars(items,"share_pct"); }
    else if(c.chart_type==="treemap"){ const items=r.type==="trade"?r.arr:(r.type==="shares"?r.shares:null); if(!items) return ""; body=treemap(items); }
    else if(c.chart_type==="sankey"&&r.type==="flows"){ body=sankeySVG(r.trade); }
    else return "";
    return `<div class="dash-card${full}"><h4>${dTitle(c.title)}</h4><p class="pp">${escapeHtml(c.purpose||"")}</p>${body}</div>`; }).filter(Boolean).join("");
  const panel=(arr,cls,head)=>{ const items=(arr||[]).map(p=>{ const r=dResolve(p.source_field,ev); if(!r) return ""; const txt=r.type==="text"?r.text:(r.type==="field"?String(r.f.value):"");
    if(!txt) return ""; const src=r.type==="field"?`<div class="s">${srcName(r.f.source)||""}${r.f.as_of?" · "+r.f.as_of:""}</div>`:"";
    return `<div class="dash-panel ${cls}"><h4>${escapeHtml(p.title||head)}</h4>${escapeHtml(txt)}${src}</div>`; }).filter(Boolean).join(""); return items; };
  const ins=panel(spec.insight_panels,"insight",t.insights), opp=panel(spec.opportunity_panels,"opp",t.opportunities), rsk=panel(spec.risk_panels,"risk",t.risks);
  const panels=(ins||opp||rsk)?`<div class="dash-panels">${ins}${opp}${rsk}</div>`:"";
  const kpiBlock=kpis?`<h3 class="domain">${t.dash_indicators}</h3><div class="dash-kpis">${kpis}</div>`:"";
  const chartBlock=charts?`<h3 class="domain">${t.dash_visuals}</h3><div class="dash-charts">${charts}</div>`:"";
  host.innerHTML=`<div class="dash-title">${escapeHtml(spec.dashboard_title||ev.country)}</div>${kpiBlock}${chartBlock}${panels}`;
  if(HAS) queue.forEach(q=>{ const el=document.getElementById(q.id); if(el) try{ new Chart(el,q.cfg); }catch(e){} });
}
function dOpts(legend,xpct){ const ar=LANG==="ar"; return {responsive:true,maintainAspectRatio:false,plugins:{legend:{display:!!legend,position:"bottom",labels:{font:{size:11}}}},scales:legend?{}:{x:{ticks:{font:{size:10}},reverse:ar},y:{ticks:{font:{size:10},callback:v=>xpct?v+"%":v}}}}; }

// ════════ Compare ════════
async function runCompare(){
  const raw=$("#cmp-input").value.trim(); if(!raw) return;
  $("#cmp-btn").disabled=true; $("#cmp-result").classList.remove("hidden");
  $("#cmp-result").innerHTML=`<p class="note">${I18N[LANG].thinking}</p>`;
  logUser("compare",`Compared: ${raw}.`);
  try{
    const r=await fetch(`/compare?countries=${encodeURIComponent(raw)}&lang=${LANG}`);
    if(!r.ok){ const e=await r.json().catch(()=>({})); throw new Error(e.detail||r.status); }
    renderComparison(await r.json());
  }catch(err){ $("#cmp-result").innerHTML=`<p style="color:var(--brick)">${escapeHtml(String(err))}</p>`; }
  $("#cmp-btn").disabled=false;
}
function renderComparison(d){
  const t=I18N[LANG]; const cs=d.countries||[];
  let head=`<th>${t.metric}</th>`+cs.map((c)=>`<th>${c.name} <span class="yr">${c.iso3}</span></th>`).join("");
  let rows="";
  (d.metrics||[]).forEach((m)=>{
    let any=false;
    const tds=cs.map((c)=>{ const cell=m.cells[c.iso3]||{}; if(cell.value==null) return `<td style="color:var(--brick)">—</td>`;
      any=true; const lead=(m.leader===c.iso3)?" class='leader'":"";
      return `<td${lead}>${fmt(cell.value,m.unit)}<div class="yr">${srcName(cell.source)||""}${cell.as_of?" · "+cell.as_of:""}</div></td>`; }).join("");
    if(any) rows+=`<tr><td><b>${pretty(m.field)}</b></td>${tds}</tr>`;
  });
  const insight=d.insight?`<h3 class="domain">${t.insight}</h3><div class="summary">${escapeHtml(d.insight)}</div>`:"";
  $("#cmp-result").innerHTML=`<table class="cmp"><tr>${head}</tr>${rows}</table>${insight}`;
}

// ════════ Chat (ChatGPT-style landing) ════════
function chatActivate(){ $("#chat-hero").classList.add("hidden"); $("#chat-main").classList.remove("hidden"); }
function chatFromHero(){ const q=$("#chat-hero-input").value.trim(); if(!q) return; $("#chat-hero-input").value=""; chatSend(q); }
function chatQuick(q){ showSection("chat"); chatSend(q); }
async function chipLastBriefing(){
  try{ const r=await fetch("/library"); const d=await r.json(); const cs=d.countries||[];
    if(!cs.length){ chatSend(LANG==="ar"?"لا توجد إحاطات بعد — ما الدول التي تنصح بالبدء بها لآسيا الوسطى؟":"No briefings yet — which Central Asia countries should we start with?"); return; }
    const last=cs[0];
    chatSend(LANG==="ar"?`أعطني أهم النقاط من آخر إحاطة عن ${last.name}`:`Give me the key points from the latest briefing on ${last.name}`);
  }catch(e){ chatSend("Give me the key points from the latest briefing."); }
}
function appendChat(text, who){ const d=document.createElement("div"); d.className="msg "+who; d.innerHTML=`<div class="b">${escapeHtml(text)}</div>`; $("#chatbox").appendChild(d); $("#chatbox").scrollTop=$("#chatbox").scrollHeight; return d; }
async function chatSend(q){
  chatActivate(); appendChat(q,"u"); logUser("chat",`Asked: ${q.slice(0,140)}`);
  const pend=appendChat(I18N[LANG].thinking,"a");
  try{
    const r=await fetch("/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:q,lang:LANG})});
    const d=await r.json();
    pend.querySelector(".b").textContent = r.ok ? (d.answer||"—") : (d.detail||"Error");
  }catch(err){ pend.querySelector(".b").textContent=String(err); }
  $("#chatbox").scrollTop=$("#chatbox").scrollHeight;
}
function runChat(){ const q=$("#chat-input").value.trim(); if(!q) return; $("#chat-input").value=""; chatSend(q); }

// ════════ modals (history / edit) ════════
function closeModal(){ $("#modalbg").classList.remove("show"); }
async function showHistory(country,name){
  const r=await fetch(`/dossier/${encodeURIComponent(country)}/field/${name}/history`); const d=await r.json();
  const rows=(d.versions||[]).map((v)=>`<div class="vhist"><b>${fmt(v.value,v.unit)}</b> — ${v.change_type} ${v.changed_by?"by "+v.changed_by:""} · ${(v.recorded_at||"").slice(0,19)}<br><span class="src">${srcName(v.source_name)||""}${v.as_of_date?" · "+v.as_of_date:""}</span></div>`).join("")||`<p class="note">—</p>`;
  $("#modal").innerHTML=`<h3>${pretty(name)}</h3>${rows}<div class="actions"><button class="btn" onclick="closeModal()">${LANG==="ar"?"إغلاق":"Close"}</button></div>`; $("#modalbg").classList.add("show");
}
function showEdit(country,name){ const ar=LANG==="ar";
  $("#modal").innerHTML=`<h3>${ar?"تعديل":"Edit"} ${pretty(name)}</h3><label>${ar?"القيمة الجديدة":"New value"}</label><input id="ev-val"/><label>${ar?"اسمك (مطلوب)":"Your name (required — audited)"}</label><input id="ev-by"/><label>${ar?"ملاحظة":"Note (optional)"}</label><textarea id="ev-note" rows="2"></textarea><p class="note">${ar?"يُحفظ كمصدر يدوي موسوم بمن ومتى.":"Saved as a MANUAL source, stamped with who + when."}</p><div class="actions"><button onclick="closeModal()" style="background:#eee;border:none;border-radius:8px;padding:10px 16px;cursor:pointer">${ar?"إلغاء":"Cancel"}</button><button class="btn" onclick="saveEdit('${country}','${name}')">${ar?"حفظ":"Save"}</button></div>`; $("#modalbg").classList.add("show");
}
async function saveEdit(country,name){
  const value=$("#ev-val").value.trim(), changed_by=$("#ev-by").value.trim(), note=$("#ev-note").value.trim();
  if(!value||!changed_by){ alert(LANG==="ar"?"القيمة والاسم مطلوبان.":"Value and your name are required."); return; }
  const r=await fetch(`/dossier/${encodeURIComponent(country)}/field/${name}/edit`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({value,changed_by,note})});
  if(!r.ok){ alert("Edit failed."); return; } const d=await r.json();
  logUser("edit",`Manually edited ${name} for ${country}.`,CURRENT?CURRENT.iso3:null);
  if(CURRENT&&CURRENT.fields[name]){ const f=CURRENT.fields[name]; f.value=d.field.value; f.source=d.field.source_name; f.as_of=d.field.as_of_date; f.found=true; f.confidence=d.field.confidence||"high"; renderTab(WS_TAB); }
  closeModal();
}
async function checkUpdates(country){
  const box=$("#updbox"); if(!box) return; box.innerHTML=`<div class="note">${I18N[LANG].thinking}</div>`;
  logUser("monitor",`Checked updates for ${country}.`);
  try{
    const r=await fetch(`/monitor/${encodeURIComponent(country)}?lang=${LANG}`,{method:"POST"});
    const d=await r.json();
    if(!d.changes||!d.changes.length){ box.innerHTML=`<div class="summary">✅ ${I18N[LANG].nochanges} <span class="yr">(${(d.checked_at||"").slice(0,16)})</span></div>`; return; }
    const items=d.changes.map(c=>`<li><b>${pretty(c.field)}</b>: ${escapeHtml(String(c.old||"—")).slice(0,50)} → <b>${escapeHtml(String(c.new)).slice(0,90)}</b> <span class="yr">(${c.source||""})</span></li>`).join("");
    box.innerHTML=`<div class="summary"><b>🔔 ${d.change_count} ${I18N[LANG].changes_found}</b><ul style="margin:8px 0 0">${items}</ul></div>`;
  }catch(e){ box.innerHTML=`<div class="note" style="color:var(--brick)">${e}</div>`; }
}

// ════════ Sources registry ════════
async function loadSources(){
  try{ const r=await fetch("/sources"); const d=await r.json(); renderSources(d.sources||[]); }
  catch(e){ $("#src-result").innerHTML=`<p class="note" style="color:var(--brick)">${e}</p>`; }
}
function renderSources(list){
  const t=I18N[LANG];
  const blocked=list.filter(s=>s.status==="blocked").length, trusted=list.length-blocked;
  const ORIG={seed:t.seed_l,auto:t.auto_l,manual:t.manual_l};
  const rows=list.map(s=>{
    const isB=s.status==="blocked";
    const tier=s.tier?`<span class="chip">T${s.tier}</span>`:"—";
    const origin=ORIG[s.origin]||s.origin||"";
    const name=escapeHtml(s.name||s.domain);
    const st=isB?` <span class="badge b-manual">${t.src_blocked}</span>`:"";
    const act=isB
      ? `<button onclick="setSource('${s.domain}','trusted')">${t.src_unblock}</button>`
      : `<button onclick="setSource('${s.domain}','blocked')" style="color:var(--brick)">${t.src_block}</button>`;
    return `<tr style="${isB?'opacity:.55':''}"><td><b>${name}</b>${st}<div class="src">${escapeHtml(s.domain)} · ${origin}</div></td><td>${tier}</td><td>${escapeHtml(s.category||'—')}</td><td>${s.times_seen||0}</td><td style="text-align:end;white-space:nowrap">${act}</td></tr>`;
  }).join("");
  $("#src-result").innerHTML=`<div class="covlabel" style="margin-bottom:10px">${list.length} ${t.src_total} · ${trusted} ${t.src_trusted} · ${blocked} ${t.src_blocked}</div>`+
    `<table><tr><th>${t.col_source}</th><th>${t.tier_l}</th><th>${t.col_cat}</th><th>${t.src_seen}</th><th></th></tr>${rows}</table>`;
}
async function setSource(domain,status){
  try{ const r=await fetch("/sources/status",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({domain,status,changed_by:USER})});
    const d=await r.json(); logUser("source",`Set ${domain} to ${status}.`); renderSources(d.sources||[]); }catch(e){ alert(e); }
}
async function addSource(){
  const domain=$("#src-domain").value.trim().toLowerCase(); if(!domain) return;
  const name=$("#src-name").value.trim()||null;
  const tv=parseInt($("#src-tier").value,10); const tier=isNaN(tv)?null:tv;
  try{ const r=await fetch("/sources",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({domain,name,tier,changed_by:USER})});
    const d=await r.json(); $("#src-domain").value="";$("#src-name").value="";$("#src-tier").value="";
    logUser("source",`Added trusted source ${domain}.`); renderSources(d.sources||[]); }catch(e){ alert(e); }
}

// ════════ Paid API keys ════════
async function loadKeys(){
  try{ const r=await fetch("/keys"); const d=await r.json(); renderKeys(d.keys||[]); }catch(e){}
}
function renderKeys(list){
  const t=I18N[LANG];
  $("#keys-list").innerHTML=list.length?list.map(k=>
    `<div class="keyrow"><span class="p">🔑 ${escapeHtml(k.provider)}</span><code>${escapeHtml(k.key_masked)}</code>
     <span class="note" style="margin:0">${(k.updated_at||"").slice(0,10)}</span><span style="flex:1"></span>
     <button class="rowbtns" style="border:1px solid var(--card-border);background:#fff;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;color:var(--brick)" onclick="delKey('${escapeHtml(k.provider)}')">${t.keys_remove}</button></div>`).join("")
    :`<p class="note">${t.keys_none}</p>`;
}
async function addKey(){
  const provider=$("#key-provider").value.trim(), key=$("#key-value").value.trim();
  if(!provider||!key) return;
  const r=await fetch("/keys",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({provider,key,added_by:USER})});
  const d=await r.json(); $("#key-provider").value="";$("#key-value").value="";
  renderKeys(d.keys||[]);
}
async function delKey(provider){
  const r=await fetch(`/keys/${encodeURIComponent(provider)}`,{method:"DELETE"});
  const d=await r.json(); renderKeys(d.keys||[]);
}

// ════════ Internal database (isolated) ════════
async function loadInternal(){
  try{ const r=await fetch("/internal"); const d=await r.json(); renderInternal(d.datasets||[]); }catch(e){}
}
function renderInternal(list){
  const t=I18N[LANG];
  $("#int-list").innerHTML=list.length?list.map(ds=>
    `<div class="keyrow"><span class="p">🗄 ${escapeHtml(ds.name)}</span>
     <span class="badge b-manual">${t.int_badge}</span>
     <span class="note" style="margin:0">${ds.n_rows||0} ${t.int_rows} · ${(ds.created_at||"").slice(0,10)}</span><span style="flex:1"></span>
     <button class="rowbtns" style="border:1px solid var(--card-border);background:#fff;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer" onclick="viewInternal(${ds.id})">${LANG==="ar"?"عرض":"view"}</button>
     <button class="rowbtns" style="border:1px solid var(--card-border);background:#fff;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;color:var(--brick)" onclick="delInternal(${ds.id})">✕</button></div>`).join("")
    :`<p class="note">${t.int_none}</p>`;
}
async function addInternal(){
  const name=$("#int-name").value.trim(); const fileEl=$("#int-file");
  if(!name||!fileEl.files.length){ alert(LANG==="ar"?"الاسم والملف مطلوبان.":"Name and file are required."); return; }
  const file=fileEl.files[0];
  const content=await file.text();
  const r=await fetch("/internal",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({name,content,filename:file.name,uploaded_by:USER})});
  const d=await r.json(); $("#int-name").value=""; fileEl.value="";
  renderInternal(d.datasets||[]);
}
async function viewInternal(id){
  const r=await fetch(`/internal/${id}`); const ds=await r.json();
  const preview=escapeHtml((ds.content||"").split("\n").slice(0,20).join("\n"));
  $("#modal").innerHTML=`<h3>🗄 ${escapeHtml(ds.name)}</h3>
    <div class="isolation">${I18N[LANG].int_iso}</div>
    <pre style="background:var(--cream);padding:12px;border-radius:8px;font-size:11.5px;overflow:auto;max-height:46vh">${preview}</pre>
    <div class="actions"><button class="btn" onclick="closeModal()">${LANG==="ar"?"إغلاق":"Close"}</button></div>`;
  $("#modalbg").classList.add("show");
}
async function delInternal(id){
  const r=await fetch(`/internal/${id}`,{method:"DELETE"}); const d=await r.json();
  renderInternal(d.datasets||[]);
}

// ════════ Parameters: model per agent ════════
const AGENT_META={
  orchestrator:["🧭","Orchestrator","Parses the request, plans the run, dispatches the team","يفسر الطلب ويخطط التشغيل ويوزع الفريق"],
  researcher:["📚","Domain Researchers","8 parallel researchers — one per intelligence domain","ثمانية باحثين متوازين — واحد لكل مجال"],
  researcher_web:["🌐","Web Researcher","Search-capable model for cited web facts","نموذج بحث للويب بحقائق موثّقة"],
  verifier:["✅","Verifier","The no-hallucination gate — cross-checks every fact","بوابة منع الهلوسة — يدقق كل حقيقة"],
  analyst:["📈","Analyst","Opportunities & risks, grounded in verified facts only","الفرص والمخاطر من الحقائق المُتحقَّقة فقط"],
  predictive:["🔮","Predictive","Forward outlook from multi-year trends (labeled projection)","التوقعات من اتجاهات متعددة السنوات"],
  council:["🏛","Council","4-seat review board: debate, verdict, dissent","مجلس من ٤ مقاعد: نقاش وحكم ورأي مخالف"],
  writer_en:["✍","Writer (EN)","Executive prose: the read, summary, talking points","الكتابة التنفيذية بالإنجليزية"],
  writer_ar:["✍","Writer (AR)","Native Arabic generation — not translation","كتابة عربية أصيلة — ليست ترجمة"],
  chat:["💬","Chat","Conversational intelligence over the verified Library","محادثة ذكية فوق المكتبة المُتحقَّقة"],
  localizer:["🔤","Localizer","EN→AR localization of data values (cached)","توطين القيم إلى العربية"],
  media:["🎨","Media Composer","Visual-summary spec from verified data","مُولّد المواد البصرية"],
  dashboard:["📊","Dashboard Designer","Chooses charts & layout for the live dashboard","يصمم لوحة المعلومات الحية"],
  visualizer:["🎬","Visualizer","Visualization Lab director — slides, one-pager, dashboard","مدير مختبر العرض"],
};
async function loadParams(){
  const host=$("#params-list"); host.innerHTML=`<p class="note">…</p>`;
  try{
    const r=await fetch("/config/models"); const d=await r.json();
    const opts=d.options||[];
    host.innerHTML=Object.entries(d.agents).map(([name,spec])=>{
      const meta=AGENT_META[name]||["🤖",name,"",""];
      const desc=LANG==="ar"?(meta[3]||meta[2]):meta[2];
      const sel=opts.map(o=>`<option value="${o}" ${o===spec.model?"selected":""}>${o}</option>`).join("")
        +(opts.includes(spec.model)?"":`<option value="${spec.model}" selected>${spec.model}</option>`);
      return `<div class="agentcard"><div class="nm">${meta[0]} ${LANG==="ar"&&AGENT_META[name]?meta[1]:meta[1]} <span class="yr">${name}</span></div>
        <div class="ds">${desc}</div>
        <select id="pm-${name}">${sel}</select>
        <input type="number" id="pt-${name}" min="0" max="1" step="0.1" value="${spec.temperature}" title="${I18N[LANG].par_temp}"/>
        <button class="btn" style="padding:8px 16px;font-size:13px" onclick="saveParam('${name}')">${I18N[LANG].par_save}</button>
        <span id="ps-${name}" class="saved"></span></div>`;
    }).join("");
  }catch(e){ host.innerHTML=`<p class="note" style="color:var(--brick)">${e}</p>`; }
}
async function saveParam(agent){
  const model=$("#pm-"+agent).value; const temp=parseFloat($("#pt-"+agent).value);
  const r=await fetch("/config/models",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({agent,model,temperature:isNaN(temp)?null:temp,changed_by:USER})});
  if(r.ok){ $("#ps-"+agent).textContent=I18N[LANG].par_saved; setTimeout(()=>{ const el=$("#ps-"+agent); if(el) el.textContent=""; },2500); }
  else{ const e=await r.json().catch(()=>({})); alert(e.detail||"failed"); }
}

// ════════ Logs page ════════
async function loadLogs(actorType){
  ["agent","user",""].forEach(a=>{ const id=a||"all"; const b=$("#lt-"+(a||"all")); if(b) b.classList.toggle("active",a===actorType); });
  const host=$("#logs-table"); host.innerHTML=`<p class="note">…</p>`;
  try{
    const r=await fetch(`/logs?limit=250${actorType?`&actor_type=${actorType}`:""}`); const d=await r.json();
    const t=I18N[LANG];
    const rows=(d.events||[]).map(e=>`<tr class="logrow ${e.actor_type}">
      <td style="white-space:nowrap">${(e.created_at||"").slice(0,19).replace("T"," ")}</td>
      <td class="actor">${e.actor_type==="agent"?"🤖":"👤"} ${escapeHtml(e.actor)}</td>
      <td><span class="chip" style="cursor:default">${escapeHtml(e.action)}</span></td>
      <td>${escapeHtml(e.detail||"")}${e.country_iso?` <span class="yr">${e.country_iso}</span>`:""}</td></tr>`).join("");
    host.innerHTML=rows?`<table><tr><th>${t.log_when}</th><th>${t.log_actor}</th><th>${t.log_action}</th><th>${t.log_detail}</th></tr>${rows}</table>`:`<p class="note">—</p>`;
  }catch(e){ host.innerHTML=`<p class="note" style="color:var(--brick)">${e}</p>`; }
}

// ════════ boot ════════
setLang("en"); showSection("home");
