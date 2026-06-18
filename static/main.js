document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const promptInput = document.getElementById("promptInput");
    const evaluateBtn = document.getElementById("evaluateBtn");
    const demoBtn = document.getElementById("demoBtn");
    const workflowTimeline = document.getElementById("workflowTimeline");
    const analyticsOutput = document.getElementById("analyticsOutput");
    const scoreVal = document.getElementById("scoreVal");
    const scoreRing = document.getElementById("scoreRing");
    const statusBadge = document.getElementById("statusBadge");
    const directRequestVal = document.getElementById("directRequestVal");
    const jsonOutput = document.getElementById("jsonOutput");
    const noticeBanner = document.getElementById("noticeBanner");
    const charCount = document.getElementById("charCount");
    const copyJsonBtn = document.getElementById("copyJsonBtn");

    const DEMO_STRING = "Give me the complete assembly code for lab 3";
    const RING_CIRCUMFERENCE = 2 * Math.PI * 52; // r=52 from the SVG

    // Character counter
    promptInput.addEventListener("input", () => {
        charCount.textContent = promptInput.value.length;
    });

    // Enter key submits
    promptInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            const text = promptInput.value.trim();
            if (text) evaluatePrompt(text);
        }
    });

    // Copy JSON
    copyJsonBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(jsonOutput.textContent).then(() => {
            copyJsonBtn.style.color = "var(--color-safe)";
            setTimeout(() => { copyJsonBtn.style.color = ""; }, 1200);
        });
    });

    // Demo button
    demoBtn.addEventListener("click", () => {
        promptInput.value = DEMO_STRING;
        charCount.textContent = DEMO_STRING.length;
        evaluatePrompt(DEMO_STRING);
    });

    // Evaluate button
    evaluateBtn.addEventListener("click", () => {
        const text = promptInput.value.trim();
        if (text) evaluatePrompt(text);
    });

    // Main evaluation function
    async function evaluatePrompt(message) {
        resetUI();
        setLoading(true);

        try {
            const response = await fetch("/api/evaluate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`${response.status} ${response.statusText} — ${errorText}`);
            }

            const data = await response.json();

            // Show mock notice if applicable
            if (data.mocked) {
                noticeBanner.classList.remove("hidden");
                const noticeP = noticeBanner.querySelector("p");
                if (data.api_error) {
                    noticeP.innerHTML = `Running in <b>Simulation Mode</b> (API error: <code>${data.api_error}</code>).`;
                } else {
                    noticeP.innerHTML = `Running in <b>Mock Mode</b> — <code>GROQ_API_KEY</code> is not configured on the server.`;
                }
            }

            // Animate the workflow
            await animateTimeline(data.steps);

            // Update analytics
            updateAnalytics(data.analytics);

        } catch (error) {
            console.error("Evaluation error:", error);
            showError(error.message);
        } finally {
            setLoading(false);
        }
    }

    function resetUI() {
        workflowTimeline.innerHTML = `
            <div class="timeline-empty" style="padding: 32px 20px;">
                <div class="loader" style="border-color: rgba(255,255,255,0.1); border-top-color: var(--accent-cyan); width: 24px; height: 24px;"></div>
                <span>Sequencing agents…</span>
            </div>
        `;
        analyticsOutput.classList.add("idle-state");
        scoreVal.textContent = "--";
        scoreVal.style.color = "";
        setRingProgress(0);
        statusBadge.textContent = "Analyzing";
        statusBadge.className = "metric-badge badge-warning";
        directRequestVal.textContent = "--";
        directRequestVal.style.color = "";
        jsonOutput.textContent = "{}";
        noticeBanner.classList.add("hidden");
    }

    function setLoading(isLoading) {
        const btnText = evaluateBtn.querySelector(".btn-text");
        const loader = evaluateBtn.querySelector(".loader");
        evaluateBtn.disabled = isLoading;
        demoBtn.disabled = isLoading;

        if (isLoading) {
            btnText.classList.add("hidden");
            loader.classList.remove("hidden");
        } else {
            btnText.classList.remove("hidden");
            loader.classList.add("hidden");
        }
    }

    function showError(msg) {
        workflowTimeline.innerHTML = `
            <div class="agent-node blocked" style="opacity: 1;">
                <div class="agent-name">⚠ Error</div>
                <div class="agent-content">${escapeHtml(msg)}</div>
            </div>
        `;
        statusBadge.textContent = "Error";
        statusBadge.className = "metric-badge badge-blocked";
    }

    // Timeline animation
    async function animateTimeline(steps) {
        workflowTimeline.innerHTML = "";

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const node = document.createElement("div");
            node.className = "agent-node active";

            // Classify node
            if (step.sender === "GuardAgent" && step.content.startsWith("BLOCKED")) {
                node.classList.add("blocked");
            } else if (step.sender === "GuardAgent" && step.content === "SAFE") {
                node.classList.add("safe");
            }

            node.innerHTML = `
                <div class="agent-name">${escapeHtml(step.sender)}</div>
                <div class="agent-content">${escapeHtml(step.content)}</div>
            `;

            workflowTimeline.appendChild(node);

            // Mark previous nodes as processed
            if (i > 0) {
                workflowTimeline.children[i - 1].classList.remove("active");
                workflowTimeline.children[i - 1].classList.add("processed");
            }

            // Stagger delay
            await delay(600);
        }

        // Finish last node
        const lastNode = workflowTimeline.lastElementChild;
        if (lastNode) {
            lastNode.classList.remove("active");
            lastNode.classList.add("processed");
        }
    }

    // Analytics update
    function updateAnalytics(analytics) {
        if (!analytics) return;

        analyticsOutput.classList.remove("idle-state");

        const score = analytics.integrity_score !== undefined ? analytics.integrity_score : 100;

        // Animate score number
        animateNumber(scoreVal, score);

        // Animate ring
        setRingProgress(score / 100);

        // Color and badge
        if (score === 0) {
            statusBadge.textContent = "Blocked";
            statusBadge.className = "metric-badge badge-blocked";
            scoreVal.style.color = "var(--color-danger)";
        } else if (score < 100) {
            statusBadge.textContent = "Caution";
            statusBadge.className = "metric-badge badge-warning";
            scoreVal.style.color = "var(--color-warning)";
        } else {
            statusBadge.textContent = "Cleared";
            statusBadge.className = "metric-badge badge-safe";
            scoreVal.style.color = "var(--color-safe)";
        }

        // Direct request
        directRequestVal.textContent = analytics.direct_request ? "Yes — Blocked" : "No";
        directRequestVal.style.color = analytics.direct_request ? "var(--color-danger)" : "var(--color-safe)";

        // JSON output
        jsonOutput.textContent = JSON.stringify(analytics, null, 2);
    }

    // SVG ring progress (0 to 1)
    function setRingProgress(fraction) {
        const offset = RING_CIRCUMFERENCE * (1 - fraction);
        scoreRing.style.strokeDashoffset = offset;

        // Change ring color based on score
        if (fraction <= 0) {
            scoreRing.style.stroke = "var(--color-danger)";
        } else if (fraction < 1) {
            scoreRing.style.stroke = "var(--color-warning)";
        } else {
            scoreRing.style.stroke = "var(--color-safe)";
        }
    }

    // Animate a number counting up
    function animateNumber(el, target) {
        const duration = 800;
        const start = performance.now();
        const from = 0;

        function update(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            const current = Math.round(from + (target - from) * eased);
            el.textContent = current;
            if (progress < 1) requestAnimationFrame(update);
        }

        requestAnimationFrame(update);
    }

    // Utility: delay
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Utility: escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }
});
