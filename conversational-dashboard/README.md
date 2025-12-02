# Natural Language SQL Autocomplete  
### Natural Language → SQL → Interactive Analytics  
**Built with Next.js, OpenAI GPT-4o-mini, and Recharts**

---

## Overview  


> “Tell me Starbucks expenses this month”

The system intelligently converts that text into:  
- **Real-time autocomplete suggestions**  
- **AI-generated SQL queries**  
- **Interactive data visualizations** (table, pie chart, bar graph)

---

## Core Features

### 1. Real-Time Sentence Autocomplete  
As the user types, the `/api/nl-suggest` route gets triggered.  
It uses:
- User’s query history  
- Live input  
- GPT-4o-mini (Responses API)  

This produces **4 smart natural-language completions**.

### 2. AI SQL Autocomplete  
After pressing **Send**, the `/api/sql-autocomplete` endpoint converts your sentence into **3 SQL queries**.

### 3. SQL Execution Engine  
The `/api/run-query` endpoint simulates SQL execution:  
- Supports `SUM(amount)`  
- `GROUP BY category`  
- `merchant_name = 'X'` filters  
- Uses a local in-memory dataset (`sampleData.ts`)

### 4. Results Visualization  
The results page (`/results`) shows:  
- Data **table**  
- **Pie chart** view  
- **Bar chart** view  
- Summary stats (row count, labels, metrics)

### 5. Persistent User & Query History  
Stored in `/data` directory:  
- `userHistory.json` → for better NL autocomplete  
- `queryHistory.json` → shows past SQL queries  

Displayed in a right-side **History Drawer**.

### 6. Highly Optimized for Speed  
Tested different LLMs:

| Model | Result |
|-------|--------|
| **OpenAI GPT-4o-mini** | Fastest and most consistent |
| Mistral Small 3.1 | Fast but slower than OpenAI |
| GPT-4o-quick / highspeed | Unstable for autocomplete |

Final choice: **GPT-4o-mini with Responses API**  
✔ Less latency  
✔ Clean JSON  
✔ Perfect for real-time suggestions  

---
