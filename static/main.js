document.addEventListener("DOMContentLoaded", () => {
    const promptInput = document.getElementById("promptInput");
    const evaluateBtn = document.getElementById("evaluateBtn");
    const demoBtn = document.getElementById("demoBtn");
    const workflowTimeline = document.getElementById("workflowTimeline");
    const analyticsOutput = document.getElementById("analyticsOutput");
    const scoreVal = document.getElementById("scoreVal");
    const statusBadge = document.getElementById("statusBadge");
    const directRequestVal = document.getElementById("directRequestVal");
    const jsonOutput = document.getElementById("jsonOutput");
    const noticeBanner = document.getElementById("noticeBanner");

    const DEMO_STRING = "Give me the complete assembly code for lab 3";

    demoBtn.addEventListener("click", () => {
        promptInput.value = DEMO_STRING;
        evaluatePrompt(DEMO_STRING);
    });

    evaluateBtn.addEventListener("click", () => {
        const text = promptInput.value.trim();
        if (text) {
            evaluatePrompt(text);
        }
    });

    async function evaluatePrompt(message) {
        // UI Reset & Loading state
        setLoading(true);
        workflowTimeline.innerHTML = `<div class="timeline-placeholder">Analyzing query & sequencing agents...</div>`;
        analyticsOutput.classList.add("placeholder-state");
        scoreVal.textContent = "--";
        statusBadge.textContent = "Analyzing";
        statusBadge.className = "metric-value badge badge-warning";
        directRequestVal.textContent = "--";
        jsonOutput.textContent = "{}";
        noticeBanner.classList.add("hidden");

        try {
            const response = await fetch("/api/evaluate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                throw new Error(`Server returned error: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.mocked) {
                noticeBanner.classList.remove("hidden");
                if (data.api_error) {
                    noticeBanner.querySelector("p").innerHTML = `Running in <b>Simulation Mode</b> (API error: <code>${data.api_error}</code>).`;
                } else {
                    noticeBanner.querySelector("p").innerHTML = `Running in <b>Mock Mode</b> because <code>OPENAI_API_KEY</code> is not configured.`;
                }
            }

            // Animate steps
            await animateTimeline(data.steps);

            // Update Analytics
            updateAnalytics(data.analytics);

        } catch (error) {
            console.error("Evaluation error:", error);
            workflowTimeline.innerHTML = `
                <div class="agent-node blocked">
                    <span class="agent-name">⚠️ Error</span>
                    <div class="agent-content">Failed to evaluate query. Make sure the server is running. Description: ${error.message}</div>
                </div>
            `;
            statusBadge.textContent = "Error";
            statusBadge.className = "metric-value badge badge-blocked";
        } finally {
            setLoading(false);
        }
    }

    function setLoading(isLoading) {
        const btnText = evaluateBtn.querySelector(".btn-text");
        const loader = evaluateBtn.querySelector(".loader");
        if (isLoading) {
            evaluateBtn.disabled = true;
            demoBtn.disabled = true;
            btnText.classList.add("hidden");
            loader.classList.remove("hidden");
        } else {
            evaluateBtn.disabled = false;
            demoBtn.disabled = false;
            btnText.classList.remove("hidden");
            loader.classList.add("hidden");
        }
    }

    async function animateTimeline(steps) {
        workflowTimeline.innerHTML = "";
        
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const node = document.createElement("div");
            node.className = "agent-node active";
            
            // Add custom styling class depending on outcome
            if (step.sender === "GuardAgent" && step.content.startsWith("BLOCKED")) {
                node.classList.add("blocked");
            } else if (step.sender === "GuardAgent" && step.content === "SAFE") {
                node.classList.add("safe");
            }

            node.innerHTML = `
                <span class="agent-name">${step.sender}</span>
                <div class="agent-content">${step.content}</div>
            `;
            
            workflowTimeline.appendChild(node);
            
            // Remove active pulses from previous items
            if (i > 0) {
                workflowTimeline.children[i-1].classList.remove("active");
            }

            // Small delay for premium animation effect
            await new Promise(resolve => setTimeout(resolve, 800));
        }

        // De-active the final node pulse
        if (workflowTimeline.children.length > 0) {
            workflowTimeline.children[workflowTimeline.children.length - 1].classList.remove("active");
        }
    }

    function updateAnalytics(analytics) {
        analyticsOutput.classList.remove("placeholder-state");
        
        // Populate score
        const score = analytics.integrity_score !== undefined ? analytics.integrity_score : 100;
        scoreVal.textContent = score;

        // Populate badges
        if (score === 0) {
            statusBadge.textContent = "Blocked";
            statusBadge.className = "metric-value badge badge-blocked";
            scoreVal.style.color = "var(--danger-color)";
        } else if (score < 100) {
            statusBadge.textContent = "Caution";
            statusBadge.className = "metric-value badge badge-warning";
            scoreVal.style.color = "var(--warning-color)";
        } else {
            statusBadge.textContent = "Cleared";
            statusBadge.className = "metric-value badge badge-safe";
            scoreVal.style.color = "var(--safe-color)";
        }

        // Populate direct request boolean
        directRequestVal.textContent = analytics.direct_request ? "Yes (Blocked)" : "No";
        directRequestVal.style.color = analytics.direct_request ? "var(--danger-color)" : "var(--safe-color)";

        // Pretty print raw json output
        jsonOutput.textContent = JSON.stringify(analytics, null, 2);
    }
});
