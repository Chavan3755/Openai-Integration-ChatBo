frappe.ui.form.on("Customer", {
    onload(frm) {
        if (window.__AI_CREATE_FIELDS__) {

            const fields = window.__AI_CREATE_FIELDS__;

            Object.keys(fields).forEach(field => {
                if (fields[field]) {
                    frm.set_value(field, fields[field]);
                }
            });

            // cleanup
            window.__AI_CREATE_FIELDS__ = null;
        }
    }
});
