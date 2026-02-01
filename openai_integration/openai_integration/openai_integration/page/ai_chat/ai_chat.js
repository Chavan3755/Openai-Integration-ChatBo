frappe.require("https://cdn.jsdelivr.net/npm/chart.js");

frappe.pages["ai-chat"].on_page_load = function (wrapper) {

    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: "🤖 ERPNext AI Assistant",
        single_column: true
    });

    page.body.html(`
        <style>
            .ai-container {
                max-width: 1100px;
                margin: auto;
                height: 75vh;
                display: flex;
                flex-direction: column;
                background: #f8fafc;
                border-radius: 12px;
                border: 1px solid #e5e7eb;
            }
            .ai-chat {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
            }
            .ai-msg {
                max-width: 75%;
                padding: 12px 14px;
                margin-bottom: 12px;
                border-radius: 14px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.08);
                font-size: 14px;
            }
            .ai-me {
                background: linear-gradient(135deg,#2563eb,#3b82f6);
                color: white;
                margin-left: auto;
                border-bottom-right-radius: 4px;
            }
            .ai-bot {
                background: white;
                border-bottom-left-radius: 4px;
            }
            .ai-input {
                display: flex;
                gap: 10px;
                padding: 12px;
                border-top: 1px solid #e5e7eb;
                background: #ffffff;
                border-radius: 0 0 12px 12px;
            }
            .ai-input textarea {
                resize: none;
                border-radius: 10px;
            }
        </style>

        <div class="ai-container">
            <div class="ai-chat" id="chat"></div>

            <div class="ai-input">
                <textarea id="msg" class="form-control"
                    rows="2"
                    placeholder="Ask ERPNext"></textarea>
                <button class="btn btn-primary" id="send">Send</button>
            </div>
        </div>
    `);

    // -----------------------------
    // ADD MESSAGE
    // -----------------------------
    function addMessage(html, me=false) {
        $("#chat").append(`
            <div class="ai-msg ${me ? "ai-me" : "ai-bot"}">
                ${html}
            </div>
        `);
        $("#chat").scrollTop($("#chat")[0].scrollHeight);
    }

    // -----------------------------
    // SEND MESSAGE
    // -----------------------------
    function sendMessage() {
        const msg = $("#msg").val().trim();
        if (!msg) return;

        $("#msg").val("");
        addMessage(msg, true);

        frappe.call({
            method: "openai_integration.openai_integration.api.ai_router",
            args: { message: msg },
            callback(r) {
                const res = r.message;

                if (!res) {
                    addMessage("❌ No response");
                    return;
                }

                if (typeof res === "string") {
                    addMessage(res);
                    return;
                }

                // OPEN DOCTYPE
                if (res.action === "open") {
                    addMessage("📂 Opening <b>" + res.doctype + "</b>");
                    frappe.set_route("List", res.doctype);
                    return;
                }

                // DASHBOARD
                if (res.action === "dashboard") {
                    const id = "dash_" + Date.now();
                    addMessage(`<b>📊 ERP Dashboard</b><canvas id="${id}" height="160"></canvas>`);

                    setTimeout(() => {
                        new Chart(document.getElementById(id), {
                            type: "bar",
                            data: {
                                labels: ["Customers","Employees","Items","Sales","Purchase"],
                                datasets: [{
                                    data: [
                                        res.data.customers,
                                        res.data.employees,
                                        res.data.items,
                                        res.data.sales,
                                        res.data.purchase
                                    ],
                                    backgroundColor: "#2563eb"
                                }]
                            }
                        });
                    }, 200);
                    return;
                }

                // ATTENDANCE
                if (res.action === "attendance_dashboard") {
                    const id = "att_" + Date.now();
                    addMessage(`<b>🧑‍💼 Attendance</b><canvas id="${id}" height="160"></canvas>`);

                    setTimeout(() => {
                        new Chart(document.getElementById(id), {
                            type: "doughnut",
                            data: {
                                labels: res.data.labels,
                                datasets: [{
                                    data: res.data.values,
                                    backgroundColor: ["#22c55e","#ef4444"]
                                }]
                            }
                        });
                    }, 200);
                    return;
                }

                // SALES DASHBOARD
                if (res.action === "sales_dashboard") {
                    const id = "sales_" + Date.now();
                    addMessage(`<b>💰 Sales Trend</b><canvas id="${id}" height="160"></canvas>`);

                    setTimeout(() => {
                        new Chart(document.getElementById(id), {
                            type: "line",
                            data: {
                                labels: res.data.labels,
                                datasets: [{
                                    label: "Sales",
                                    data: res.data.values,
                                    borderColor: "#16a34a",
                                    backgroundColor: "rgba(22,163,74,0.2)",
                                    fill: true,
                                    tension: 0.4
                                }]
                            }
                        });
                    }, 200);
                    return;
                }

                addMessage(JSON.stringify(res));
            }
        });
    }

    $("#send").on("click", sendMessage);

    // ENTER TO SEND
    document.getElementById("msg").addEventListener("keydown", function(e){
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
};
