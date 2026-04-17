#  Deal Tracker  Business Acquisition Evaluator

A specialized web application designed for entrepreneurs and investors to track, evaluate, and compare potential business acquisitions within the Autonomous Systems portfolio.

---

##  Key Features

- **Deal Pipeline (Kanban)**: Manage your acquisition funnel with a drag-and-drop interface across four stages: Researching, In Talks, Under Review, and Closed/Passed.
- **Side-by-Side Evaluator**: Compare up to 3 businesses simultaneously. Input asking prices, revenue, and owner profit (SDE/EBITDA) to see:
  - Price-to-Profit Ratios (Multiples)
  - Annual Loan Payments (SBA Loan Calculator)
  - Post-Debt Take-Home Cash Flow
  - Loan Safety Ratios (DSCR)
- **Interactive Dashboard**: Real-time stats on your active reviews, valuation multiples, and overall pipeline health.
- **Data Portability**: 
  - Save data locally to your browser.
  - Export your full pipeline to **CSV** (for Excel/Google Sheets).
  - Secure **JSON Backups** for total data protection and restoration.

---

##  How to Use

### Local Deployment
Since the Acquisition Tracker is a client-side SPA, you can run it directly from your file system:
1. Open `index.html` in any modern web browser.
2. Start adding businesses using the "Add New Business" button.

### Evaluation Criteria
When comparing deals, use the **Evaluator** tab to plug in financials. Pay close attention to:
- **Take-Home Pay**: This is your actual income after the bank gets paid.
- **Safety Ratio**: Ensure this is above **1.25x** for a robust deal.

---

##  Project Structure

- `index.html`: The core UI and layout using modern semantic HTML5.
- `app.js`: Vanilla JavaScript logic handling state management, calculations, and local storage.
- `style.css`: Premium CSS styling with a responsive navigation sidebar and Kanban layouts.

---

##  Built With
- **Vanilla JavaScript**: Zero dependencies for maximum performance and privacy.
- **FontAwesome**: For intuitive iconography.
- **Inter Font**: For high-readability financial data.
