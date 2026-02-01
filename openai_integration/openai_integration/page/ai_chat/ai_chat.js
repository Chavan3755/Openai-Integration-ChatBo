frappe.pages['ai-chat'].on_page_load = function (wrapper) {

    let page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'AI Chat',
        single_column: true
    });

    let $chat = $(`
        <div style="max-width:800px;margin:auto">

            <div id="chat-box" style="
                border:1px solid #ddd;
                height:400px;
                padding:10px;
                overflow-y:auto;
                margin-bottom:10px;
                background:#f9f9f9;
            "></div>

            <textarea id="user-input" class="form-control"
                placeholder="Type here (try: dashboard)"
                style="margin-bottom:10px"></textarea>

            <button class="btn btn-primary" id="send-btn">Send</button>
        </div>
    `);

    page.body.append($chat);

    addAI("👋 Hello! Type <b>dashboard</b> to see system data.");

    function sendMessage() {

        let msg = $('#user-input').val().trim();
        if (!msg) return;

        addUser(msg);
        $('#user-input').val('');

        // 🔹 DASHBOARD
        if (msg.toLowerCase() === "dashboard") {
            fetchSystemData();
            return;
        }

        $('#chat-box').append(`<div id="typing">AI is typing...</div>`);

        frappe.call({
            method: 'openai_integration.openai_integration.api.chat_with_ai',
            args: { message: msg },
            callback: function (r) {
                $('#typing').remove();
                if (r.message) addAI(r.message);
            }
        });
    }

    function fetchSystemData() {
        frappe.call({
            method: 'openai_integration.openai_integration.api.get_system_data',
            callback: function (r) {
                let d = r.message;
                addAI(`
📊 <b>System Dashboard</b><br>
Leads: ${d.leads}<br>
Customers: ${d.customers}<br>
Sales Invoices: ${d.sales_invoices}<br>
Purchase Invoices: ${d.purchase_invoices}<br>
Items: ${d.items}<br>
Employees: ${d.employees}
                `);
            }
        });
    }

    function addUser(text) {
        $('#chat-box').append(`<div style="text-align:right">${text}</div>`);
    }

    function addAI(text) {
        $('#chat-box').append(`<div style="text-align:left">${text}</div>`);
    }

    $('#send-btn').on('click', sendMessage);

    $('#user-input').keypress(function (e) {
        if (e.which === 13) sendMessage();
    });
};

