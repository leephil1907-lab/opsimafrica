export const workflows = [
  {
    id: 'receiving',
    title: 'Receiving & stock checks',
    subtitle: 'A good stockroom starts at the receiving bay.',
    description:
      'Receive a delivery, spot damaged stock, and put every carton in the right place. A practical introduction to a reliable receiving process.',
    category: 'Warehouse',
    industry: 'Supermarket',
    difficulty: 'Beginner',
    duration: 6,
    color: 'sage',
    icon: 'package',
    skills: ['Stock inspection', 'Quantity checks', 'FEFO rotation'],
    scene: 'receiving',
    briefing:
      'Mainland Foods has delivered 12 cartons against delivery note NG-2047. Two cartons are crushed and must be quarantined. The remaining stock expires on 28 February 2027; existing stock expires on 31 January 2027.',
    document: [
      { label: 'Supplier', value: 'Mainland Foods' },
      { label: 'Delivery note', value: 'NG-2047' },
      { label: 'Cartons delivered', value: '12' },
      { label: 'Damaged cartons', value: '2' },
    ],
    steps: [
      {
        id: 'inspect',
        title: 'Inspect the delivery',
        instruction:
          'Find the crushed carton. Select it in the room or use the item buttons below.',
        type: 'object',
        options: [
          { value: 'damaged-carton', label: 'Crushed carton' },
          { value: 'good-carton', label: 'Sealed carton' },
          { value: 'shelf-a', label: 'Storage rack A' },
        ],
        answer: 'damaged-carton',
        hint: 'Look for the carton with a red damage label at the receiving bay.',
        explanation: 'Visible damage should be identified before stock is accepted.',
      },
      {
        id: 'count',
        title: 'Count what arrived',
        instruction:
          'Count all delivered cartons, including those that are damaged. How many cartons arrived?',
        type: 'number',
        unit: 'cartons',
        answer: '12',
        hint: 'The delivery note records 12 cartons. Do not subtract the damaged ones yet.',
        explanation: 'Record the total delivered quantity before recording exceptions.',
      },
      {
        id: 'quarantine',
        title: 'Separate damaged stock',
        instruction: 'Choose where the two damaged cartons should be moved.',
        type: 'object',
        options: [
          { value: 'quarantine', label: 'Quarantine zone' },
          { value: 'shelf-a', label: 'Sellable stock rack' },
          { value: 'dispatch', label: 'Dispatch bench' },
        ],
        answer: 'quarantine',
        hint: 'Use the marked quarantine zone, away from saleable stock.',
        explanation:
          'Quarantining damaged stock prevents it being accidentally sold or dispatched.',
      },
      {
        id: 'accept',
        title: 'Record accepted stock',
        instruction:
          'You received 12 cartons and quarantined 2. How many cartons should be added to sellable inventory?',
        type: 'number',
        unit: 'cartons',
        answer: '10',
        hint: 'Accepted quantity = delivered quantity minus damaged quantity.',
        explanation: 'Only 10 undamaged cartons should increase available inventory.',
      },
      {
        id: 'rotate',
        title: 'Put stock away correctly',
        instruction:
          'Existing stock expires in January; the new stock expires in February. Choose the correct rotation method.',
        type: 'choice',
        options: [
          { value: 'fefo', label: 'Keep January stock in front; place February stock behind' },
          { value: 'new-first', label: 'Put all the new stock in front for easy access' },
          { value: 'mix', label: 'Mix the cartons to distribute the weight' },
        ],
        answer: 'fefo',
        hint: 'FEFO means first-expiry, first-out.',
        explanation: 'First-expiry, first-out reduces waste and keeps older stock moving.',
      },
    ],
  },
  {
    id: 'picking',
    title: 'Pick, pack & dispatch',
    subtitle: 'The right item. The right quantity. Every time.',
    description:
      'Fulfil a customer order, verify quantities, select protective packaging, and confirm a clean dispatch handover.',
    category: 'Logistics',
    industry: 'Logistics',
    difficulty: 'Intermediate',
    duration: 5,
    color: 'sand',
    icon: 'truck',
    skills: ['Order picking', 'Packing checks', 'Dispatch'],
    scene: 'picking',
    briefing:
      'Prepare order ORD-1082 for Ada Okafor. The order is for 3 cartons of Golden Grain Rice, SKU RCE-01, from rack A. Check the item, pack it securely, and match the dispatch label before handover.',
    document: [
      { label: 'Order number', value: 'ORD-1082' },
      { label: 'Customer', value: 'Ada Okafor' },
      { label: 'Product / SKU', value: 'Golden Grain Rice / RCE-01' },
      { label: 'Required quantity', value: '3 cartons · Rack A' },
    ],
    steps: [
      {
        id: 'pick',
        title: 'Pick the correct product',
        instruction: 'Find Golden Grain Rice, SKU RCE-01, on rack A.',
        type: 'object',
        options: [
          { value: 'rice', label: 'RCE-01 · Golden Grain Rice' },
          { value: 'milk', label: 'MLK-02 · Peak Milk' },
          { value: 'oil', label: 'OIL-03 · SunGold Oil' },
        ],
        answer: 'rice',
        hint: 'Match the SKU RCE-01 on the order to the label on rack A.',
        explanation:
          'Checking the SKU, not just the packaging, prevents look-alike product errors.',
      },
      {
        id: 'quantity',
        title: 'Confirm the pick quantity',
        instruction: 'How many cartons of rice does order ORD-1082 require?',
        type: 'number',
        unit: 'cartons',
        answer: '3',
        hint: 'The order document requests 3 cartons.',
        explanation: 'Match both the item and the quantity before moving to packing.',
      },
      {
        id: 'pack',
        title: 'Choose the packing station',
        instruction: 'Move the picked cartons to the marked packing bench for a final inspection.',
        type: 'object',
        options: [
          { value: 'dispatch', label: 'Packing & dispatch bench' },
          { value: 'quarantine', label: 'Quarantine zone' },
          { value: 'shelf-b', label: 'Unsorted stock rack' },
        ],
        answer: 'dispatch',
        hint: 'Use the bench labelled PACK & DISPATCH.',
        explanation: 'A dedicated packing station makes final checks consistent.',
      },
      {
        id: 'protect',
        title: 'Protect the order',
        instruction: 'Which packing method will best protect the cartons in transit?',
        type: 'choice',
        options: [
          { value: 'secure', label: 'Inspect, secure the cartons, and add a readable order label' },
          { value: 'loose', label: 'Leave cartons loose so the driver can count them' },
          { value: 'cover', label: 'Cover the product labels with dispatch tape' },
        ],
        answer: 'secure',
        hint: 'A secure pack still needs readable identification.',
        explanation: 'Protection and a readable label reduce damage and misrouting.',
      },
      {
        id: 'label',
        title: 'Verify the dispatch label',
        instruction: 'Choose the correct order and customer for the dispatch handover.',
        type: 'choice',
        options: [
          { value: 'correct', label: 'ORD-1082 · Ada Okafor · 3 cartons' },
          { value: 'wrong-order', label: 'ORD-1083 · Ada Okafor · 3 cartons' },
          { value: 'wrong-qty', label: 'ORD-1082 · Ada Okafor · 2 cartons' },
        ],
        answer: 'correct',
        hint: 'Check the order number, customer, and carton count together.',
        explanation:
          'A complete dispatch check prevents an accurate pick becoming a wrong delivery.',
      },
    ],
  },
  {
    id: 'cash',
    title: 'Cash-up & reconciliation',
    subtitle: 'Close the day with confidence, not guesswork.',
    description:
      'Reconcile a retail till, identify a shortfall, and prepare an accountable end-of-day handover.',
    category: 'Retail',
    industry: 'Supermarket',
    difficulty: 'Intermediate',
    duration: 4,
    color: 'lavender',
    icon: 'wallet',
    skills: ['Cash handling', 'Reconciliation', 'Shift handover'],
    scene: 'cash',
    briefing:
      'The till began with a ₦10,000 float. Cash sales totalled ₦82,500, and an authorised cash payout was ₦2,500. Counted cash at close is ₦88,500. Card and transfer sales are tracked separately and are not in the drawer.',
    document: [
      { label: 'Opening float', value: '₦10,000' },
      { label: 'Cash sales', value: '₦82,500' },
      { label: 'Authorised payout', value: '₦2,500' },
      { label: 'Counted cash', value: '₦88,500' },
    ],
    steps: [
      {
        id: 'expected',
        title: 'Calculate expected cash',
        instruction:
          'Opening float + cash sales − payout. How much cash should be in the till? Enter a number, without the currency symbol.',
        type: 'number',
        unit: 'NGN',
        answer: '90000',
        hint: '10,000 + 82,500 − 2,500 = 90,000.',
        explanation:
          'Include the float and authorised payouts when calculating expected physical cash.',
      },
      {
        id: 'variance',
        title: 'Find the cash variance',
        instruction:
          'Expected cash is ₦90,000 and counted cash is ₦88,500. What is the absolute size of the difference?',
        type: 'number',
        unit: 'NGN',
        answer: '1500',
        hint: '90,000 − 88,500 = 1,500.',
        explanation: 'The drawer is ₦1,500 short.',
      },
      {
        id: 'classify',
        title: 'Classify the difference',
        instruction: 'Which description correctly records this variance?',
        type: 'choice',
        options: [
          { value: 'short', label: 'Cash shortage of ₦1,500' },
          { value: 'over', label: 'Cash surplus of ₦1,500' },
          { value: 'balanced', label: 'Balanced till; no action required' },
        ],
        answer: 'short',
        hint: 'The counted cash is lower than the expected cash.',
        explanation: 'A shortage must be recorded accurately, not hidden in sales or expenses.',
      },
      {
        id: 'resolve',
        title: 'Handle the discrepancy',
        instruction: 'Choose the responsible next step before signing off.',
        type: 'choice',
        options: [
          {
            value: 'review',
            label: 'Recount, review receipts and payouts, then notify the supervisor',
          },
          { value: 'edit', label: 'Reduce recorded cash sales until the figures match' },
          { value: 'ignore', label: 'Leave the shortage for the next cashier to resolve' },
        ],
        answer: 'review',
        hint: 'Protect the audit trail. Check the evidence and escalate.',
        explanation: 'A documented recount and supervisor review preserve accountability.',
      },
      {
        id: 'handover',
        title: 'Complete the shift handover',
        instruction: 'What should both staff members sign?',
        type: 'choice',
        options: [
          {
            value: 'signed',
            label: 'A handover showing expected cash, counted cash, variance, and follow-up',
          },
          { value: 'total', label: 'A note showing only the total daily sales' },
          { value: 'verbal', label: 'No document; a verbal handover is enough' },
        ],
        answer: 'signed',
        hint: 'A reliable handover records what was counted and what remains unresolved.',
        explanation: 'A signed, complete handover protects both the outgoing and incoming cashier.',
      },
    ],
  },
  {
    id: 'safety',
    title: 'Spot the safety risks',
    subtitle: 'Small checks. A safer working day.',
    description:
      'Walk the stockroom, find blocked access and spills, and make safe decisions before an incident happens.',
    category: 'Safety',
    industry: 'Warehouse',
    difficulty: 'Beginner',
    duration: 3,
    color: 'peach',
    icon: 'shield',
    skills: ['Hazard spotting', 'Safe storage', 'Incident reporting'],
    scene: 'safety',
    briefing:
      'You are opening the stockroom for the morning shift. A carton is blocking the marked emergency exit, liquid is on the floor near dispatch, and a heavy carton is on the top rack. Identify the risks and choose safe corrective actions.',
    document: [
      { label: 'Location', value: 'Mainland stockroom' },
      { label: 'Shift', value: 'Opening inspection' },
      { label: 'Known hazards', value: 'Blocked exit · spill · heavy load' },
      { label: 'Priority', value: 'Prevent access to danger' },
    ],
    steps: [
      {
        id: 'exit',
        title: 'Find the blocked escape route',
        instruction: 'Select the carton blocking the marked emergency exit.',
        type: 'object',
        options: [
          { value: 'blocked-exit', label: 'Carton at the emergency exit' },
          { value: 'rice', label: 'Rice carton on rack A' },
          { value: 'dispatch', label: 'Dispatch bench' },
        ],
        answer: 'blocked-exit',
        hint: 'Follow the green EXIT sign at the back of the room.',
        explanation: 'Emergency escape routes must remain clear at all times.',
      },
      {
        id: 'spill',
        title: 'Identify the floor hazard',
        instruction: 'Find the spill near the packing bench.',
        type: 'object',
        options: [
          { value: 'spill', label: 'Liquid spill on the floor' },
          { value: 'quarantine', label: 'Marked quarantine zone' },
          { value: 'shelf-a', label: 'Storage rack A' },
        ],
        answer: 'spill',
        hint: 'Look for the blue-grey patch beside the dispatch bench.',
        explanation: 'Even a small spill can create a serious slip risk.',
      },
      {
        id: 'isolate',
        title: 'Respond to the spill safely',
        instruction: 'What should you do first?',
        type: 'choice',
        options: [
          {
            value: 'isolate',
            label: 'Restrict access, put out a warning, and arrange safe cleanup',
          },
          { value: 'walk', label: 'Walk through it to find the source' },
          { value: 'wait', label: 'Wait for the next shift to clean it up' },
        ],
        answer: 'isolate',
        hint: 'Prevent anyone else entering the hazard before cleaning it.',
        explanation: 'Control access to the hazard and follow the workplace cleanup procedure.',
      },
      {
        id: 'heavy',
        title: 'Store heavy cartons safely',
        instruction: 'Where should a heavy carton normally be stored?',
        type: 'choice',
        options: [
          { value: 'low', label: 'On a suitable low shelf, within its rated load limit' },
          { value: 'high', label: 'On the highest shelf to leave space below' },
          { value: 'aisle', label: 'In an aisle where everyone can see it' },
        ],
        answer: 'low',
        hint: 'Reduce lifting height and respect the rack load rating.',
        explanation:
          'Heavy items belong low down, without overloading shelves or blocking walkways.',
      },
      {
        id: 'report',
        title: 'Close the inspection',
        instruction: 'Choose the correct way to record your findings.',
        type: 'choice',
        options: [
          {
            value: 'log',
            label: 'Log the hazards, corrective actions, owner, and unresolved issues',
          },
          { value: 'photo', label: 'Take a photo but do not tell anyone' },
          { value: 'skip', label: 'Skip the log because the hazards are obvious' },
        ],
        answer: 'log',
        hint: 'The next shift needs to know what was found and what still needs attention.',
        explanation:
          'A clear record turns a one-off inspection into an accountable safety process.',
      },
    ],
  },
];

export function publicScenario(scenario, includeAnswers = false) {
  if (includeAnswers) return scenario;
  return { ...scenario, steps: scenario.steps.map(({ answer, ...step }) => step) };
}
