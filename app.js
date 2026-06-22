// ========================================
// AcqTrack - Business Acquisition Tracker
// All data stored locally via LocalStorage
// ========================================

const STORAGE_KEY = 'acqtrack_deals';
const COMPARISON_CARD_COUNT = 3;

let deals = [];
let editingDealId = null;
let draggedCard = null;

// ----------------------------------------
// Data Layer
// ----------------------------------------

function loadDeals() {
    const raw = localStorage.getItem(STORAGE_KEY);
    deals = raw ? JSON.parse(raw).map(normalizeDeal).filter(Boolean) : [];
    // Migrate old stage names to new 4-stage system
    deals.forEach(d => {
        if (d.stage === 'Sourced')    d.stage = 'Researching';
        if (d.stage === 'Contacted')  d.stage = 'In Talks';
        if (d.stage === 'NDA')        d.stage = 'In Talks';
        if (d.stage === 'IOI_LOI')    d.stage = 'Under Review';
        if (d.stage === 'Diligence')  d.stage = 'Under Review';
    });
}

function saveDeals() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deals));
}

function generateId() {
    return `deal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getDealById(id) {
    return deals.find(d => d.id === id);
}

function normalizeDeal(deal) {
    if (!deal) return deal;

    return {
        ...deal,
        askingPrice: parseFloat(deal.askingPrice) || 0,
        ebitda: parseFloat(deal.ebitda) || 0,
        revenue: parseFloat(deal.revenue) || 0,
        debt: parseFloat(deal.debt) || 0,
        rateAnn: parseFloat(deal.rateAnn ?? deal.rate ?? deal.loanRate) || 0,
        years: parseFloat(deal.years ?? deal.term ?? deal.loanTerm) || 0,
        stage: deal.stage || 'Researching',
        notes: deal.notes || '',
    };
}

function getCompareCardIndexFromSelect(selectId) {
    return parseInt(selectId.split('-').pop(), 10) - 1;
}

function getComparisonFields(index) {
    const n = index + 1;
    return {
        card: document.getElementById(`biz-card-${n}`),
        select: document.getElementById(`compare-source-${n}`),
        name: document.getElementById(`biz${n}-name`),
        asking: document.getElementById(`b${n}-asking`),
        revenue: document.getElementById(`b${n}-revenue`),
        ebitda: document.getElementById(`b${n}-ebitda`),
        debt: document.getElementById(`b${n}-debt`),
        rateAnn: document.getElementById(`b${n}-rate`),
        years: document.getElementById(`b${n}-term`),
    };
}

function setComparisonCardValues(index, values, locked) {
    const fields = getComparisonFields(index);
    if (!fields.card) return;

    fields.name.value = values.name || `Business ${index + 1}`;
    fields.asking.value = values.askingPrice ?? 0;
    fields.revenue.value = values.revenue ?? 0;
    fields.ebitda.value = values.ebitda ?? 0;
    fields.debt.value = values.debt ?? 0;
    fields.rateAnn.value = values.rateAnn ?? 0;
    fields.years.value = values.years ?? 0;

    [fields.name, fields.asking, fields.revenue, fields.ebitda, fields.debt, fields.rateAnn, fields.years].forEach(input => {
        input.disabled = locked;
    });
}

function setComparisonCardToCustom(index, keepValues = false) {
    const fields = getComparisonFields(index);
    if (!fields.card) return;

    fields.select.value = 'custom';
    [fields.name, fields.asking, fields.revenue, fields.ebitda, fields.debt, fields.rateAnn, fields.years].forEach(input => {
        input.disabled = false;
    });

    if (!keepValues) {
        fields.name.value = `Business ${index + 1}`;
        fields.asking.value = 0;
        fields.revenue.value = 0;
        fields.ebitda.value = 0;
        fields.debt.value = 0;
        fields.rateAnn.value = 0;
        fields.years.value = 0;
    }
}

function applyComparisonSelection(index, value) {
    const deal = value === 'custom' ? null : getDealById(value);
    if (!deal) {
        setComparisonCardToCustom(index, value === 'custom');
        return;
    }

    setComparisonCardValues(index, deal, true);
    getComparisonFields(index).select.value = deal.id;
}

function refreshComparisonDealOptions() {
    for (let i = 0; i < COMPARISON_CARD_COUNT; i += 1) {
        const fields = getComparisonFields(i);
        if (!fields.select) continue;

        const currentValue = fields.select.value || 'custom';
        const options = ['<option value="custom">Custom</option>'];
        deals.forEach(deal => {
            const labelBits = [escapeHtml(deal.name || 'Unnamed Business')];
            if (deal.industry) labelBits.push(escapeHtml(deal.industry));
            if (deal.askingPrice > 0) labelBits.push(`$${formatNum(deal.askingPrice)}`);
            options.push(`<option value="${deal.id}">${labelBits.join(' • ')}</option>`);
        });
        fields.select.innerHTML = options.join('');

        const hasCurrentDeal = currentValue !== 'custom' && getDealById(currentValue);
        if (hasCurrentDeal) {
            fields.select.value = currentValue;
            applyComparisonSelection(i, currentValue);
        } else {
            fields.select.value = 'custom';
            if (currentValue !== 'custom') {
                setComparisonCardToCustom(i, false);
            } else {
                applyComparisonSelection(i, 'custom');
            }
        }
    }
    runComparison();
}

function resetComparisonCards() {
    for (let i = 0; i < COMPARISON_CARD_COUNT; i += 1) {
        setComparisonCardToCustom(i, false);
    }
}

// ----------------------------------------
// Navigation
// ----------------------------------------

function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            const view = item.getAttribute('data-view');
            switchView(view);
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

function switchView(viewName) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.add('active');

    if (viewName === 'dashboard') renderDashboard();
    if (viewName === 'pipeline')  renderKanban();
    if (viewName === 'evaluator') refreshComparisonDealOptions();
}

// ----------------------------------------
// Modal
// ----------------------------------------

function openModal(dealId = null) {
    editingDealId = dealId;
    const modal = document.getElementById('deal-modal');
    const title = document.getElementById('modal-title');
    const form  = document.getElementById('deal-form');

    form.reset();

    if (dealId) {
        const deal = normalizeDeal(getDealById(dealId));
        title.textContent = 'Edit Business';
        document.getElementById('deal-id').value         = deal.id;
        document.getElementById('deal-name').value       = deal.name;
        document.getElementById('deal-industry').value   = deal.industry    || '';
        document.getElementById('deal-location').value   = deal.location    || '';
        document.getElementById('deal-source').value     = deal.source      || 'Business Broker';
        document.getElementById('deal-asking').value     = deal.askingPrice || 0;
        document.getElementById('deal-ebitda').value     = deal.ebitda      || 0;
        document.getElementById('deal-revenue').value    = deal.revenue     || 0;
        document.getElementById('deal-debt').value       = deal.debt        || 0;
        document.getElementById('deal-rate').value       = deal.rateAnn     || 0;
        document.getElementById('deal-term').value       = deal.years       || 0;
        document.getElementById('deal-stage').value      = deal.stage       || 'Researching';
        document.getElementById('deal-notes').value      = deal.notes       || '';
    } else {
        title.textContent = 'Add New Business';
        document.getElementById('deal-stage').value = 'Researching';
    }

    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('deal-modal').classList.remove('active');
    editingDealId = null;
}

function saveDeal() {
    const name = document.getElementById('deal-name').value.trim();
    if (!name) {
        alert('Please enter a Business Name.');
        return;
    }

    const nowISO = new Date().toISOString();

    if (editingDealId) {
        const deal        = getDealById(editingDealId);
        deal.name         = name;
        deal.industry     = document.getElementById('deal-industry').value.trim();
        deal.location     = document.getElementById('deal-location').value.trim();
        deal.source       = document.getElementById('deal-source').value;
        deal.askingPrice  = parseFloat(document.getElementById('deal-asking').value) || 0;
        deal.ebitda       = parseFloat(document.getElementById('deal-ebitda').value)  || 0;
        deal.revenue      = parseFloat(document.getElementById('deal-revenue').value) || 0;
        deal.debt         = parseFloat(document.getElementById('deal-debt').value)    || 0;
        deal.rateAnn      = parseFloat(document.getElementById('deal-rate').value)    || 0;
        deal.years        = parseFloat(document.getElementById('deal-term').value)    || 0;
        deal.stage        = document.getElementById('deal-stage').value;
        deal.notes        = document.getElementById('deal-notes').value.trim();
        deal.updatedAt    = nowISO;
    } else {
        deals.unshift({
            id:          generateId(),
            name:        name,
            industry:    document.getElementById('deal-industry').value.trim(),
            location:    document.getElementById('deal-location').value.trim(),
            source:      document.getElementById('deal-source').value,
            askingPrice: parseFloat(document.getElementById('deal-asking').value) || 0,
            ebitda:      parseFloat(document.getElementById('deal-ebitda').value)  || 0,
            revenue:     parseFloat(document.getElementById('deal-revenue').value) || 0,
            debt:        parseFloat(document.getElementById('deal-debt').value)    || 0,
            rateAnn:     parseFloat(document.getElementById('deal-rate').value)    || 0,
            years:       parseFloat(document.getElementById('deal-term').value)    || 0,
            stage:       document.getElementById('deal-stage').value,
            notes:       document.getElementById('deal-notes').value.trim(),
            createdAt:   nowISO,
            updatedAt:   nowISO,
        });
    }

    saveDeals();
    closeModal();
    renderKanban();
    renderDashboard();
    refreshComparisonDealOptions();
}

function deleteDeal(id) {
    if (!confirm('Are you sure you want to delete this business? This cannot be undone.')) return;
    deals = deals.filter(d => d.id !== id);
    saveDeals();
    renderKanban();
    renderDashboard();
    refreshComparisonDealOptions();
}

// ----------------------------------------
// Dashboard
// ----------------------------------------

function renderDashboard() {
    const total     = deals.length;
    const diligence = deals.filter(d => d.stage === 'Under Review').length;
    const dead      = deals.filter(d => d.stage === 'Closed').length;

    const multiples = deals
        .filter(d => d.ebitda > 0)
        .map(d => d.askingPrice / d.ebitda);
    const avgMultiple = multiples.length
        ? (multiples.reduce((a, b) => a + b, 0) / multiples.length).toFixed(1)
        : '0.0';

    document.getElementById('stat-total').textContent     = total;
    document.getElementById('stat-diligence').textContent = diligence;
    document.getElementById('stat-dead').textContent      = dead;
    document.getElementById('stat-multiple').textContent  = `${avgMultiple}x`;

    const recent = [...deals]
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 8);

    const list = document.getElementById('activity-list');
    list.innerHTML = '';

    if (recent.length === 0) {
        list.innerHTML = '<li class="empty-state">No businesses yet. Click <strong>+ Add New Business</strong> to get started.</li>';
        return;
    }

    const stageColors = {
        'Researching':  '#6366f1',
        'In Talks':     '#0ea5e9',
        'Under Review': '#10b981',
        'Closed':       '#94a3b8',
    };

    recent.forEach(deal => {
        const li    = document.createElement('li');
        li.className = 'activity-item';
        const color  = stageColors[deal.stage] || '#6366f1';
        const date   = new Date(deal.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const multiple = deal.ebitda > 0
            ? `${(deal.askingPrice / deal.ebitda).toFixed(1)}x`
            : '';

        li.innerHTML = `
            <div class="activity-dot" style="background:${color};"></div>
            <div class="activity-info">
                <strong>${escapeHtml(deal.name)}</strong>
                <span style="color:${color}; font-size:12px;">${deal.stage}</span>
            </div>
            <div class="activity-meta">
                <span class="activity-multiple">${multiple}</span>
                <span class="activity-date">${date}</span>
            </div>
        `;
        li.addEventListener('click', () => openModal(deal.id));
        list.appendChild(li);
    });
}

// ----------------------------------------
// Kanban Pipeline  4 stages
// ----------------------------------------

const STAGES = ['Researching', 'In Talks', 'Under Review', 'Closed'];

const STAGE_COLORS = {
    'Researching':  '#6366f1',
    'In Talks':     '#0ea5e9',
    'Under Review': '#10b981',
    'Closed':       '#94a3b8',
};

function renderKanban() {
    STAGES.forEach(stage => {
        const col   = document.querySelector(`.kanban-column[data-stage="${stage}"]`);
        if (!col) return;
        const cards      = col.querySelector('.kanban-cards');
        const count      = col.querySelector('.count');
        const stageDeals = deals.filter(d => d.stage === stage);

        count.textContent = stageDeals.length;
        cards.innerHTML   = '';

        if (stageDeals.length === 0) {
            const empty = document.createElement('div');
            empty.className   = 'empty-column';
            empty.textContent = 'Drop a business here';
            cards.appendChild(empty);
        }

        stageDeals.forEach(deal => {
            const card           = document.createElement('div');
            card.className       = 'deal-card';
            card.draggable       = true;
            card.dataset.dealId  = deal.id;

            const multiple = deal.ebitda > 0
                ? `${(deal.askingPrice / deal.ebitda).toFixed(1)}x`
                : '';
            const asking = deal.askingPrice > 0
                ? `$${formatNum(deal.askingPrice)}`
                : 'Price unknown';

            card.innerHTML = `
                <div class="deal-card-header">
                    <div class="deal-card-title">${escapeHtml(deal.name)}</div>
                    <div class="deal-card-actions">
                        <i class="fa-solid fa-pen-to-square edit-btn" title="Edit" data-id="${deal.id}"></i>
                        <i class="fa-solid fa-trash-can delete-btn" title="Delete" data-id="${deal.id}"></i>
                    </div>
                </div>
                ${deal.industry ? `<div class="deal-card-metric"><span>Industry</span><span>${escapeHtml(deal.industry)}</span></div>` : ''}
                <div class="deal-card-metric"><span>Asking</span><span>${asking}</span></div>
                <div class="deal-card-metric"><span>Price/Profit Ratio</span><span>${multiple}</span></div>
                ${deal.source ? `<div class="deal-badge">${escapeHtml(deal.source)}</div>` : ''}
            `;

            card.querySelector('.edit-btn').addEventListener('click', e => {
                e.stopPropagation();
                openModal(deal.id);
            });
            card.querySelector('.delete-btn').addEventListener('click', e => {
                e.stopPropagation();
                deleteDeal(deal.id);
            });
            card.addEventListener('click', () => openModal(deal.id));
            card.addEventListener('dragstart', handleDragStart);
            card.addEventListener('dragend',   handleDragEnd);

            cards.appendChild(card);
        });
    });
}

// ----------------------------------------
// Drag and Drop
// ----------------------------------------

function handleDragStart(e) {
    draggedCard       = this;
    this.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.dealId);
}

function handleDragEnd() {
    this.style.opacity = '1';
    document.querySelectorAll('.kanban-column').forEach(col => col.classList.remove('drag-over'));
    draggedCard = null;
}

function initDragAndDrop() {
    document.querySelectorAll('.kanban-column').forEach(col => {
        col.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            col.classList.add('drag-over');
        });
        col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
        col.addEventListener('drop', e => {
            e.preventDefault();
            col.classList.remove('drag-over');
            const dealId   = e.dataTransfer.getData('text/plain');
            const newStage = col.getAttribute('data-stage');
            const deal     = getDealById(dealId);
            if (deal && deal.stage !== newStage) {
                deal.stage     = newStage;
                deal.updatedAt = new Date().toISOString();
                saveDeals();
                renderKanban();
                renderDashboard();
            }
        });
    });
}

// ----------------------------------------
// Evaluator  3-Business Comparison
// ----------------------------------------

function calcBiz(prefix) {
    const asking  = parseFloat(document.getElementById(`${prefix}-asking`).value)  || 0;
    const revenue = parseFloat(document.getElementById(`${prefix}-revenue`).value) || 0;
    const ebitda  = parseFloat(document.getElementById(`${prefix}-ebitda`).value)  || 0;
    const debt    = parseFloat(document.getElementById(`${prefix}-debt`).value)    || 0;
    const rateAnn = parseFloat(document.getElementById(`${prefix}-rate`).value)    || 0;
    const years   = parseFloat(document.getElementById(`${prefix}-term`).value)    || 0;

    const complete = asking > 0 && revenue > 0 && ebitda > 0 && debt > 0 && rateAnn > 0 && years > 0;

    const multiple    = ebitda > 0 ? asking / ebitda : null;
    const margin      = revenue > 0 ? (ebitda / revenue) * 100 : null;

    const monthlyRate = (rateAnn / 100) / 12;
    const nPayments   = years * 12;
    let annualDS      = 0;
    if (complete) {
        const monthly = debt * (monthlyRate * Math.pow(1 + monthlyRate, nPayments))
                        / (Math.pow(1 + monthlyRate, nPayments) - 1);
        annualDS = monthly * 12;
    }

    const cashflow = complete ? ebitda - annualDS : 0;
    const dscr     = complete && annualDS > 0 ? ebitda / annualDS : null;

    let score = 0;
    if (complete) {
        if (dscr >= 1.25) score += 3;
        else if (dscr >= 1.0) score += 1;
        if (multiple !== null && multiple <= 3.5) score += 3;
        else if (multiple !== null && multiple <= 5.0) score += 2;
        else if (multiple !== null && multiple <= 6.5) score += 1;
        if (margin !== null && margin >= 25) score += 2;
        else if (margin !== null && margin >= 15) score += 1;
    }

    let verdict = '';
    let verdictClass = '';
    if (!complete) {
        verdict = 'Enter data';
        verdictClass = 'verdict-neutral';
    } else if (dscr >= 1.25 && multiple !== null && multiple <= 4.5) {
        verdict = 'Strong';
        verdictClass = 'verdict-good';
    } else if (dscr >= 1.0) {
        verdict = 'Proceed with Caution';
        verdictClass = 'verdict-warn';
    } else {
        verdict = 'Risky';
        verdictClass = 'verdict-bad';
    }

    return { asking, revenue, ebitda, debt, rateAnn, years, annualDS, cashflow, dscr, multiple, margin, verdict, verdictClass, score, complete };
}

function getComparisonFieldState(deal) {
    const fields = [
        { key: 'asking', label: 'asking price' },
        { key: 'revenue', label: 'annual revenue' },
        { key: 'ebitda', label: 'annual owner profit' },
        { key: 'debt', label: 'loan amount' },
        { key: 'rateAnn', label: 'loan interest rate' },
        { key: 'years', label: 'loan term' },
    ];

    return {
        hasCoreData: ['asking', 'revenue', 'ebitda', 'debt'].every(key => (deal[key] || 0) > 0),
        isComparable: deal.complete === true,
        missingLabels: fields
            .filter(field => (deal[field.key] || 0) <= 0)
            .map(field => field.label),
    };
}

function buildNextSteps(results, winner) {
    const [biz1, biz2, biz3] = results;
    const biz1State = getComparisonFieldState(biz1);
    const biz2State = getComparisonFieldState(biz2);
    const biz3State = getComparisonFieldState(biz3);
    const comparisonReady = biz1State.isComparable && biz2State.isComparable;

    if (!comparisonReady) {
        const steps = [];
        if (!biz1State.isComparable) {
            steps.push(`Business 1 still needs: ${biz1State.missingLabels.join(', ')}.`);
        }
        if (!biz2State.isComparable) {
            steps.push(`Business 2 still needs: ${biz2State.missingLabels.join(', ')}.`);
        }
        if (biz3State.hasCoreData && !biz3State.isComparable) {
            steps.push('Business 3 has partial data. Finish it only if you want a third option in the comparison.');
        }
        if (!steps.length) {
            steps.push('Enter the deal inputs for Businesses 1 and 2 before comparing them.');
        }
        return {
            summary: 'Complete Businesses 1 and 2 before asking the tool to point to a winner.',
            action: 'Fill in the missing comparison fields first.',
            steps
        };
    }

    const comparableDeals = results.filter(r => r.complete);
    const bestDeal = winner || comparableDeals[0] || null;

    if (biz3State.hasCoreData && !biz3State.isComparable) {
        const steps = [
            `Business 1 is complete. Business 2 is complete.`,
            `Business 3 has partial data. Finish it only if you want a 3-way comparison.`,
        ];
        if (bestDeal && bestDeal.dscr !== null) {
            steps.push(`Use ${bestDeal.name} as the current reference while Business 3 remains incomplete.`);
        }
        return {
            summary: bestDeal
                ? `Businesses 1 and 2 are ready. ${bestDeal.name} is the strongest complete deal so far.`
                : 'Businesses 1 and 2 are ready to compare.',
            action: bestDeal ? `Move ${bestDeal.name} to Under Review and request the financial package.` : 'Review the complete deals side by side.',
            steps
        };
    }

    if (bestDeal && bestDeal.dscr !== null) {
        const isStrongSafety = bestDeal.dscr >= 1.25;
        const isTightButPositive = bestDeal.dscr >= 1.0;

        if (isStrongSafety && bestDeal.multiple !== null && bestDeal.multiple <= 4.5) {
            return {
                summary: `Best current deal: ${bestDeal.name}. The return and loan safety both look strong enough to keep moving.`,
                action: `Move ${bestDeal.name} to Under Review and request the financial package.`,
                steps: [
                    `Ask for the most recent profit statements and tax returns on ${bestDeal.name}.`,
                    'Confirm the profit is repeatable before getting emotionally attached to the deal.',
                    'Keep the other businesses in the pipeline only if they can beat this cash flow.'
                ]
            };
        }

        if (isTightButPositive) {
            return {
                summary: `Best current deal: ${bestDeal.name}. It is promising, but the financing still looks tight.`,
                action: 'Use the pipeline to track it, then renegotiate price or reduce leverage.',
                steps: [
                    `See whether ${bestDeal.name} can support a smaller loan or a better price.`,
                    'Check whether the EBITDA is normalized and repeatable.',
                    'Keep it in Under Review until the numbers clear your safety threshold.'
                ]
            };
        }
    }

    return {
        summary: bestDeal
            ? `${bestDeal.name} is the strongest complete option so far, but the numbers are not safe enough for a confident move.`
            : 'No complete deal is clear enough yet to justify a strong recommendation.',
        action: 'Hold off on a bid and gather better numbers before advancing.',
        steps: [
            'Verify profit with tax returns, P&L statements, or other source documents.',
            'Rebuild the financing with a lower purchase price or a smaller loan.',
            'Use the pipeline only for light tracking until a deal clears your threshold.'
        ]
    };
}

function renderNextSteps(results, winner) {
    const guidance = buildNextSteps(results, winner);
    const summaryEl = document.getElementById('next-steps-summary');
    const listEl = document.getElementById('next-steps-list');
    const actionEl = document.getElementById('next-step-action');

    if (!summaryEl || !listEl || !actionEl) return;

    summaryEl.textContent = guidance.summary;
    actionEl.textContent = guidance.action;

    listEl.innerHTML = '';
    guidance.steps.forEach(step => {
        const li = document.createElement('li');
        li.textContent = step;
        listEl.appendChild(li);
    });
}

function runComparison() {
    const bizzes = [
        { prefix: 'b1', name: document.getElementById('biz1-name').value || 'Business 1', n: 1 },
        { prefix: 'b2', name: document.getElementById('biz2-name').value || 'Business 2', n: 2 },
        { prefix: 'b3', name: document.getElementById('biz3-name').value || 'Business 3', n: 3 },
    ];

    // Update table headers
    bizzes.forEach(b => {
        document.getElementById(`th-biz${b.n}`).textContent = b.name;
    });

    const results = bizzes.map(b => ({ ...calcBiz(b.prefix), ...b }));
    const biz1State = getComparisonFieldState(results[0]);
    const biz2State = getComparisonFieldState(results[1]);
    const comparisonReady = biz1State.isComparable && biz2State.isComparable;
    const comparableResults = comparisonReady ? results.filter(r => r.complete) : [];

    // Find winner by score only when Businesses 1 and 2 are fully entered
    const maxScore = comparableResults.length ? Math.max(...comparableResults.map(r => r.score)) : null;
    const winner   = maxScore === null ? null : comparableResults.find(r => r.score === maxScore);

    results.forEach(r => {
        const n = r.n;

        setCell(`r${n}-multiple`, r.multiple !== null ? r.multiple.toFixed(2) + 'x' : '', n, results, 'multiple', false);
        setCell(`r${n}-margin`,   r.margin   !== null ? r.margin.toFixed(1) + '%' : '',   n, results, 'margin',   true);
        setCell(`r${n}-ds`,       r.complete && r.annualDS  > 0 ? `-$${formatNum(r.annualDS)}` : '', n, results, 'annualDS', false);
        setCell(`r${n}-cashflow`, r.complete ? `$${formatNum(r.cashflow)}` : '', n, results, 'cashflow', true);
        setCell(`r${n}-dscr`,     r.dscr !== null ? r.dscr.toFixed(2) + 'x' : '', n, results, 'dscr', true);

        const verdictCell = document.getElementById(`r${n}-verdict`);
        verdictCell.textContent = r.verdict;
        verdictCell.className   = r.verdictClass;
    });

    // Highlight winning column
    document.querySelectorAll('.compare-table td, .compare-table th').forEach(el => el.classList.remove('winner-col'));
    if (winner) {
        document.querySelectorAll(`.compare-table td:nth-child(${winner.n + 1}), .compare-table th:nth-child(${winner.n + 1})`).forEach(el => el.classList.add('winner-col'));
    }

    const banner = document.getElementById('winner-banner');
    if (winner) {
        banner.style.display = 'block';
        banner.innerHTML = `
            <i class="fa-solid fa-trophy"></i>
            <div>
                <strong>Best current deal: ${escapeHtml(winner.name)}</strong>
                <div>Use the guidance card below to decide the next move.</div>
            </div>
        `;
    } else {
        banner.style.display = 'none';
    }

    renderNextSteps(results, winner);
}

// Helper  highlights best/worst cell in a row
function setCell(id, displayVal, n, results, key, higherIsBetter) {
    const cell = document.getElementById(id);
    if (!cell) return;
    cell.textContent  = displayVal;
    cell.className    = '';

    const vals = results.map(r => r[key]).filter(v => v !== null && v !== undefined && !Number.isNaN(v));
    if (vals.length < 2) return;
    const best  = higherIsBetter ? Math.max(...vals) : Math.min(...vals);
    const worst = higherIsBetter ? Math.min(...vals) : Math.max(...vals);
    const myVal = results[n - 1][key];

    if (myVal !== null && myVal !== undefined && !Number.isNaN(myVal)) {
        if (myVal === best)  cell.classList.add('cell-best');
        else if (myVal === worst) cell.classList.add('cell-worst');
    }
}

function initComparison() {
    document.querySelectorAll('.compare-source').forEach((el, index) => {
        el.addEventListener('change', e => {
            applyComparisonSelection(index, e.target.value);
            runComparison();
        });
    });
    document.querySelectorAll('.biz-input, .biz-name-input').forEach(el => {
        el.addEventListener('input', runComparison);
    });
    refreshComparisonDealOptions();
    runComparison();
}

// ----------------------------------------
// CSV Export
// ----------------------------------------

function exportCSV() {
    const headers = [
        'Business Name', 'Type of Business', 'City / State',
        'How Found', 'Asking Price ($)', 'Annual Revenue ($)', 'Annual Owner Profit ($)',
        'Loan Amount ($)', 'Loan Interest Rate (%)', 'Loan Term (Years)',
        'Price-to-Profit Ratio', 'Deal Stage', 'Notes', 'Date Added', 'Last Updated'
    ];

    const rows = deals.map(d => {
        const multiple = d.ebitda > 0 ? (d.askingPrice / d.ebitda).toFixed(2) : '';
        return [
            d.name        || '',
            d.industry    || '',
            d.location    || '',
            d.source      || '',
            d.askingPrice || '',
            d.revenue     || '',
            d.ebitda      || '',
            d.debt        || '',
            d.rateAnn     || '',
            d.years       || '',
            multiple,
            d.stage       || '',
            (d.notes || '').replace(/\n/g, ' '),
            d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '',
            d.updatedAt ? new Date(d.updatedAt).toLocaleDateString() : '',
        ];
    });

    const csvContent = [headers, ...rows]
        .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `acqtrack_pipeline_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ----------------------------------------
// JSON Export / Import
// ----------------------------------------

function exportData() {
    const data = JSON.stringify(deals, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `acqtrack_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const imported = JSON.parse(e.target.result);
            if (!Array.isArray(imported)) throw new Error('Invalid format');
            if (!confirm(`This will merge ${imported.length} deal(s) from the backup with your current data. Continue?`)) return;
            let added = 0;
            imported.forEach(d => {
                if (!getDealById(d.id)) { deals.push(normalizeDeal(d)); added++; }
            });
            saveDeals();
            alert(`Import complete. ${added} new business(es) added.`);
            renderKanban();
            renderDashboard();
            refreshComparisonDealOptions();
        } catch {
            alert('Could not read that file. Please make sure it is an AcqTrack backup (.json).');
        }
    };
    reader.readAsText(file);
}

// ----------------------------------------
// Utilities
// ----------------------------------------

function formatNum(n) {
    if (n === 0 || isNaN(n)) return '0';
    const abs  = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(2) + 'M';
    if (abs >= 1_000)     return sign + (abs / 1_000).toFixed(0) + 'K';
    return sign + abs.toFixed(0);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;');
}

// ----------------------------------------
// Init
// ----------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    loadDeals();
    initNavigation();
    initDragAndDrop();
    initComparison();

    renderDashboard();
    renderKanban();

    document.getElementById('new-deal-btn').addEventListener('click', () => openModal());
    document.getElementById('close-modal').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
    document.getElementById('btn-save-deal').addEventListener('click', saveDeal);

    document.getElementById('deal-modal').addEventListener('click', e => {
        if (e.target === document.getElementById('deal-modal')) closeModal();
    });

    document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
    document.getElementById('btn-export').addEventListener('click', exportData);

    document.getElementById('btn-import').addEventListener('click', () => {
        document.getElementById('file-import').click();
    });
    document.getElementById('file-import').addEventListener('change', e => {
        if (e.target.files.length) importData(e.target.files[0]);
        e.target.value = '';
    });

    document.getElementById('btn-clear-data').addEventListener('click', () => {
        if (confirm('Are you SURE you want to permanently delete ALL business data? This cannot be undone!')) {
            deals = [];
            saveDeals();
            renderKanban();
            renderDashboard();
            refreshComparisonDealOptions();
            resetComparisonCards();
            runComparison();
            alert('All data cleared.');
        }
    });
});
