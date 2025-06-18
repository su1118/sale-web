from flask import Flask, request, jsonify, session, render_template
import json, os
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'mysecretkey'

INVENTORY_FILE = "inventory.json"
STAFF_FILE = "staff.json"
LOG_FILE = "log.txt"

def load_json(path):
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def log_action(text):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"[{timestamp}] {text}\n")


    
@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    with open("staff.json", "r", encoding="utf-8") as f:
        staff = json.load(f)

    if username in staff and staff[username]["password"] == password:
        session["user"] = staff[username]["name"]  # 可以保留
        session["staff_code"] = username           # 新增
        session["staff_name"] = staff[username]["name"]  # 新增
        return jsonify({ "status": "success" })
    else:
        return jsonify({ "status": "fail", "message": "帳號或密碼錯誤" })

    
@app.route("/api/current-user")
def current_user():
    if "staff_code" in session:
        return jsonify({
            "username": session["staff_code"],
            "name": session.get("staff_name")
        })
    return jsonify({"username": None}), 401




@app.route("/api/products")
def api_products():
    data = load_json(INVENTORY_FILE)
    result = []
    for code, item in data.items():
        base = {
            "code": code,
            "name": item["name"],
            "price": item["price"],
            "category": item.get("category", "未分類")
        }
        if "styles" in item:
            base["styles"] = item["styles"]
        else:
            base["center"] = item.get("center", 0)
            base["warehouse"] = item.get("warehouse", 0)
        result.append(base)
    return jsonify(result)

@app.route("/api/activity-products", methods=["GET"])
def api_activity_products():
    with open("activity.json", "r", encoding="utf-8") as f:
        raw_data = json.load(f)
    result = []
    for code, item in raw_data.items():
        item["code"] = code
        result.append(item)
    return jsonify(result)


@app.route("/api/occupancy-products", methods=["GET"])
def api_occupancy_products():
    with open("occupancy.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    return jsonify(data)


@app.route("/api/sale", methods=["POST"])
def api_sale():
    if "staff_code" not in session:
        return jsonify({ "status": "error", "message": "未登入" })
    data = request.json
    items = data.get("items", [])
    identity = data.get("identity")
    channel = data.get("channel")
    order_id = data.get("order_id", "N/A")
    timestamp = data.get("timestamp", datetime.now().isoformat())

    inventory = load_json(INVENTORY_FILE)
    total = 0
    result = []

    for item in items:
        code = item["code"]
        style = item.get("style", "")
        qty = item["qty"]
        price = item["price"]
        total += price * qty

        if code not in inventory:
            result.append({ "code": code, "status": "❌ 無商品" })
            continue

        if "styles" in inventory[code]:
            if style not in inventory[code]["styles"]:
                result.append({ "code": code, "style": style, "status": "❌ 無樣式" })
                continue
            if inventory[code]["styles"][style]["center"] < qty:
                result.append({ "code": code, "style": style, "status": "❌ 庫存不足" })
                continue
            inventory[code]["styles"][style]["center"] -= qty
        else:
            if inventory[code]["center"] < qty:
                result.append({ "code": code, "status": "❌ 庫存不足" })
                continue
            inventory[code]["center"] -= qty
        result.append({ "code": code, "status": "✅ 成功" })

    save_json(INVENTORY_FILE, inventory)

    log_text = f"【銷售】{session['staff_name']} 身分:{identity} 通路:{channel} 單號:{order_id} 金額:${total}"
    for item in items:
        log_text += f"\n - {item['name']} {item.get('style','')} x{item['qty']}"
    log_action(log_text)

    return jsonify({ "status": "success", "result": result })

@app.route("/api/return", methods=["POST"])
def api_return():
    if "staff_code" not in session:
        return jsonify({ "status": "error", "message": "未登入" })
    data = request.json
    order_id = data.get("order_id", "N/A")
    timestamp = data.get("timestamp", datetime.now().isoformat())
    items = data.get("items", [])

    inventory = load_json(INVENTORY_FILE)
    total = 0
    result = []

    for item in items:
        code = item["code"]
        style = item.get("style", "")
        qty = item["qty"]
        price = item["price"]
        type_ = item["type"]
        name = item["name"]
        total += price * qty if type_ in ["exchange_out"] else -price * qty

        if code not in inventory:
            result.append({ "code": code, "status": "❌ 無此商品" })
            continue

        if "styles" in inventory[code]:
            if style not in inventory[code]["styles"]:
                result.append({ "code": code, "style": style, "status": "❌ 無樣式" })
                continue
            if type_ in ["return", "exchange_in"]:
                inventory[code]["styles"][style]["center"] += qty
            elif type_ == "exchange_out":
                if inventory[code]["styles"][style]["center"] < qty:
                    result.append({ "code": code, "status": "❌ 中心庫存不足" })
                    continue
                inventory[code]["styles"][style]["center"] -= qty
        else:
            if type_ in ["return", "exchange_in"]:
                inventory[code]["center"] += qty
            elif type_ == "exchange_out":
                if inventory[code]["center"] < qty:
                    result.append({ "code": code, "status": "❌ 中心庫存不足" })
                    continue
                inventory[code]["center"] -= qty

        result.append({ "code": code, "status": "✅ 已處理" })

    save_json(INVENTORY_FILE, inventory)

    log_text = f"【退/換貨】{session['staff_name']} 單號:{order_id} 退還金額：${total}"

    returns = []
    exchanges = []

    for item in items:
        item_type = item.get("type", "")
        if item_type in ["return", "exchange_in"]:
            returns.append(item)
        elif item_type == "exchange_out":
            exchanges.append(item)
        else:
            log_text += f"\n❗ 未知項目: {item.get('name', '未命名')}（缺 type）"

    if returns:
        log_text += "\n退回："
        for item in returns:
            log_text += f"\n - {item['name']} {item.get('style','')} x-{item['qty']}"

    if exchanges:
        log_text += "\n換出："
        for item in exchanges:
            log_text += f"\n - {item['name']} {item.get('style','')} x{item['qty']}"

    log_action(log_text)



    return jsonify({ "status": "success", "result": result })

@app.route("/api/gift", methods=["POST"])
def api_gift():
    if "staff_code" not in session:
        return jsonify({ "status": "error", "message": "未登入" })
    data = request.json
    items = data.get("items", [])
    reason = data.get("reason", "未提供")
    timestamp = data.get("timestamp")

    inventory = load_json(INVENTORY_FILE)
    result = []

    for item in items:
        code = item["code"]
        style = item.get("style", "")
        qty = item["qty"]

        if code not in inventory:
            result.append({ "code": code, "status": "❌ 無此商品" })
            continue

        if "styles" in inventory[code]:
            if style not in inventory[code]["styles"]:
                result.append({ "code": code, "style": style, "status": f"❌ 無樣式 {style}" })
                continue
            if inventory[code]["styles"][style]["center"] < qty:
                result.append({ "code": code, "style": style, "status": f"❌ 庫存不足" })
                continue
            inventory[code]["styles"][style]["center"] -= qty
        else:
            if inventory[code]["center"] < qty:
                result.append({ "code": code, "status": "❌ 庫存不足" })
                continue
            inventory[code]["center"] -= qty

        result.append({ "code": code, "status": "✅ 已扣庫存" })

    save_json(INVENTORY_FILE, inventory)

    log_text = f"【贈與/工用】{session['staff_name']} 用途：{reason}"
    for item in items:
        log_text += f"\n - {item['name']} {item.get('style', '')} x{item['qty']}"
    log_action(log_text)

    return jsonify({ "status": "success", "result": result, "message": "已完成扣庫存與紀錄" })


@app.route("/api/transfer", methods=["POST"])
def api_transfer():
    if "staff_code" not in session:
        return jsonify({ "status": "error", "message": "未登入" })
    data = request.json
    items = data.get("items", [])
    timestamp = data.get("timestamp", datetime.now().isoformat())

    inventory = load_json(INVENTORY_FILE)
    result = []

    for item in items:
        code = item["code"]
        style = item.get("style", "")
        qty = item["qty"]

        if code not in inventory:
            result.append({ "code": code, "status": "❌ 無此商品代碼" })
            continue

        if "styles" in inventory[code]:
            if style not in inventory[code]["styles"]:
                result.append({ "code": code, "style": style, "status": f"❌ 無樣式 {style}" })
                continue
            if inventory[code]["styles"][style]["warehouse"] < qty:
                result.append({ "code": code, "style": style, "status": f"❌ 倉庫庫存不足（剩 {inventory[code]['styles'][style]['warehouse']}）" })
                continue
            # 調貨：倉庫減，中心加
            inventory[code]["styles"][style]["warehouse"] -= qty
            inventory[code]["styles"][style]["center"] += qty
            result.append({ "code": code, "style": style, "status": "✅ 調貨完成" })
        else:
            if inventory[code]["warehouse"] < qty:
                result.append({ "code": code, "status": f"❌ 倉庫庫存不足（剩 {inventory[code]['warehouse']}）" })
                continue
            inventory[code]["warehouse"] -= qty
            inventory[code]["center"] += qty
            result.append({ "code": code, "status": "✅ 調貨完成" })

    save_json(INVENTORY_FILE, inventory)

    log_text = f"【調貨】{session['staff_name']}"
    for item in items:
        log_text += f"\n - {item['name']} {item.get('style', '')} x{item['qty']}"
    log_action(log_text)

    return jsonify({ "status": "success", "result": result, "message": "調貨處理完成" })


@app.route("/api/restock", methods=["POST"])
def api_restock():
    if "staff_code" not in session:
        return jsonify({ "status": "error", "message": "未登入" })
    data = request.json
    items = data.get("items", [])
    timestamp = data.get("timestamp", datetime.now().isoformat())

    inventory = load_json(INVENTORY_FILE)
    result = []

    for item in items:
        code = item["code"]
        style = item.get("style", "")
        qty = item["qty"]

        if code not in inventory:
            result.append({ "code": code, "status": "❌ 無此商品代碼" })
            continue

        if "styles" in inventory[code]:
            if style not in inventory[code]["styles"]:
                result.append({ "code": code, "style": style, "status": f"❌ 無樣式 {style}" })
                continue
            inventory[code]["styles"][style]["warehouse"] += qty
            result.append({ "code": code, "style": style, "status": "✅ 倉庫補貨完成" })
        else:
            inventory[code]["warehouse"] += qty
            result.append({ "code": code, "status": "✅ 倉庫補貨完成" })

    save_json(INVENTORY_FILE, inventory)

    log_text = f"【補貨】{session['staff_name']}"
    for item in items:
        log_text += f"\n - {item['name']} {item.get('style', '')} x{item['qty']}"
    log_action(log_text)

    return jsonify({ "status": "success", "result": result, "message": "補貨完成" })

@app.route("/api/activity-sale", methods=["POST"])
def api_activity_sale():
    if "staff_code" not in session:
        return jsonify({ "status": "error", "message": "未登入" })
    data = request.json
    items = data.get("items", [])
    order_id = data.get("order_id", "N/A")
    identity = data.get("identity", "不明身分")
    timestamp = data.get("timestamp", datetime.now().isoformat())

    # 讀取 activity.json
    with open("activity.json", "r", encoding="utf-8") as f:
        inventory = json.load(f)

    result = []

    for item in items:
        code = item["code"]
        style = item.get("style", "")
        qty = item["qty"]

        if code not in inventory:
            result.append({ "code": code, "status": "❌ 無此商品代碼" })
            continue

        if "styles" in inventory[code]:
            if style not in inventory[code]["styles"]:
                result.append({ "code": code, "style": style, "status": f"❌ 無樣式 {style}" })
                continue
            if inventory[code]["styles"][style]["center"] < qty:
                result.append({ "code": code, "style": style, "status": f"❌ 中心庫存不足（剩 {inventory[code]['styles'][style]['center']}）" })
                continue
            inventory[code]["styles"][style]["center"] -= qty
            result.append({ "code": code, "style": style, "status": "✅ 扣庫成功" })
        else:
            if inventory[code]["center"] < qty:
                result.append({ "code": code, "status": f"❌ 中心庫存不足（剩 {inventory[code]['center']}）" })
                continue
            inventory[code]["center"] -= qty
            result.append({ "code": code, "status": "✅ 扣庫成功" })

    # 存回 activity.json
    with open("activity.json", "w", encoding="utf-8") as f:
        json.dump(inventory, f, ensure_ascii=False, indent=2)

    # 紀錄 log
    total = sum(item["qty"] * item["price"] for item in items)
    log_text = f"【活動銷售】{session['staff_name']} 單號:{order_id} 身分:{identity} 金額:${total}"
    for item in items:
        log_text += f"\n - {item['name']} {item.get('style', '')} x{item['qty']}"

    log_action(log_text)

    return jsonify({ "status": "success", "result": result, "message": "活動銷售完成" })


@app.route("/api/occupy", methods=["POST"])
def api_occupy():
    if "staff_code" not in session:
        return jsonify({ "status": "error", "message": "未登入" })

    data = request.json
    mode = data.get("mode")  # "use" or "return"
    items = data.get("items", [])
    reason = data.get("reason", "")
    timestamp = data.get("timestamp", datetime.now().isoformat())

    inventory = load_json(INVENTORY_FILE)
    occupancy = load_json("occupancy.json")
    result = []

    for item in items:
        code = item["code"]
        style = item.get("style", "")
        qty = item["qty"]

        if code not in inventory:
            result.append({ "code": code, "status": "❌ 無此商品" })
            continue

        # 保證 occupancy 中有該商品（初始化）
        if code not in occupancy:
            occupancy[code] = {
                "name": item["name"],
                "category": item.get("category", "未分類"),
                "price": item.get("price", 0),
                "styles": {}
            }

        if "styles" in inventory[code]:
            if style not in inventory[code]["styles"]:
                result.append({ "code": code, "style": style, "status": "❌ 無樣式" })
                continue

            # 初始化 occupancy 該樣式
            if style not in occupancy[code]["styles"]:
                occupancy[code]["styles"][style] = { "center": 0, "warehouse": 0 }

            if mode == "use":
                if inventory[code]["styles"][style]["warehouse"] < qty:
                    result.append({ "code": code, "style": style, "status": f"❌ 倉庫不足" })
                    continue
                inventory[code]["styles"][style]["warehouse"] -= qty
                occupancy[code]["styles"][style]["warehouse"] += qty
                result.append({ "code": code, "style": style, "status": "✅ 已佔用" })

            elif mode == "return":
                if occupancy[code]["styles"][style]["warehouse"] < qty:
                    result.append({ "code": code, "style": style, "status": f"❌ 佔用量不足" })
                    continue
                occupancy[code]["styles"][style]["warehouse"] -= qty
                inventory[code]["styles"][style]["warehouse"] += qty
                result.append({ "code": code, "style": style, "status": "✅ 已歸還" })

        else:
            # 無樣式類商品
            if mode == "use":
                if inventory[code]["warehouse"] < qty:
                    result.append({ "code": code, "status": f"❌ 倉庫不足" })
                    continue
                inventory[code]["warehouse"] -= qty
                occupancy.setdefault(code, {
                    "name": item["name"],
                    "category": item.get("category", "未分類"),
                    "price": item.get("price", 0),
                    "center": 0,
                    "warehouse": 0
                })
                occupancy[code]["warehouse"] += qty
                result.append({ "code": code, "status": "✅ 已佔用" })

            elif mode == "return":
                if occupancy.get(code, {}).get("warehouse", 0) < qty:
                    result.append({ "code": code, "status": f"❌ 佔用量不足" })
                    continue
                occupancy[code]["warehouse"] -= qty
                inventory[code]["warehouse"] += qty
                result.append({ "code": code, "status": "✅ 已歸還" })

    # 儲存更新
    save_json(INVENTORY_FILE, inventory)
    save_json("occupancy.json", occupancy)

    # log
    label = "佔用" if mode == "use" else "歸還"
    log_text = f"【{label}】{session['staff_name']}"
    if reason and mode == "use":
        log_text += f" 用途：{reason}"
    for item in items:
        log_text += f"\n - {item['name']} {item.get('style','')} x{item['qty']}"
    log_action(log_text)

    return jsonify({ "status": "success", "result": result, "message": f"{label}完成" })


@app.route("/api/monthly-summary", methods=["POST"])
def api_monthly_summary():
    try:
        import re
        import pandas as pd
        from datetime import datetime

        req = request.json
        start = req.get("start_date")
        end = req.get("end_date")

        if not start or not end:
            return jsonify({ "status": "error", "message": "請提供 start_date 和 end_date" })

        start_dt = datetime.strptime(start, "%Y-%m-%d")
        end_dt = datetime.strptime(end, "%Y-%m-%d")

        with open(LOG_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()

        # 僅讀 inventory 建立價格查表
        inventory = load_json(INVENTORY_FILE)
        price_lookup = {}
        for code, item in inventory.items():
            name = item["name"]
            price = item.get("price", 0)
            if "styles" in item:
                for size in item["styles"]:
                    price_lookup[f"{name}_{size}"] = price
            else:
                price_lookup[f"{name}_"] = price

        summary = { "銷售": [], "退換貨": [], "活動": [] }
        current_type = None
        include = False

        for line in lines:
            line = line.strip()
            time_match = re.match(r"^\[(.*?)\]\s+(【.*?】)", line)
            if time_match:
                time_str = time_match.group(1)
                log_type = time_match.group(2)
                log_dt = datetime.strptime(time_str, "%Y-%m-%d %H:%M:%S")
                include = start_dt <= log_dt <= end_dt
                if not include:
                    current_type = None
                    continue
                if "活動" in log_type:
                    current_type = "活動"
                elif "退" in log_type or "換" in log_type:
                    current_type = "退換貨"
                elif "銷售" in log_type:
                    current_type = "銷售"
                else:
                    current_type = None
                continue

            if include and current_type and re.match(r"^\s*-\s", line):
                item_line = line.strip("- ").strip()
                item_match = re.match(r"(.+)\s+x(-?\d+)", item_line)
                if item_match:
                    full_name = item_match.group(1).strip()
                    qty = int(item_match.group(2))
                    tokens = full_name.split()
                    if len(tokens) >= 2:
                        style = tokens[-1]
                        name = " ".join(tokens[:-1])
                    else:
                        name = full_name
                        style = ""
                    key = f"{name}_{style}"
                    price = price_lookup.get(key, 0)
                    summary[current_type].append({
                        "商品": name,
                        "尺寸": style,
                        "數量": qty,
                        "金額": price * qty
                    })

        def aggregate(df):
            if df.empty:
                return df
            return df.groupby(["商品", "尺寸"], as_index=False).agg({
                "數量": "sum",
                "金額": "sum"
            }).sort_values(by="金額", ascending=False)

        df_sale = aggregate(pd.DataFrame(summary["銷售"]))
        df_return = aggregate(pd.DataFrame(summary["退換貨"]))
        df_activity = aggregate(pd.DataFrame(summary["活動"]))

        file_path = "monthly_summary.xlsx"
        with pd.ExcelWriter(file_path, engine="xlsxwriter") as writer:
            df_sale.to_excel(writer, sheet_name="銷售", index=False)
            df_return.to_excel(writer, sheet_name="退換貨", index=False)
            df_activity.to_excel(writer, sheet_name="活動銷售", index=False)

        return jsonify({ "status": "success", "file": file_path })

    except Exception as e:
        return jsonify({ "status": "error", "message": f"後端錯誤：{str(e)}" })


@app.route("/api/add-product", methods=["POST"])
def add_product():
    try:
        data = request.json
        name = data.get("name")
        category = data.get("category")
        price = data.get("price")
        styles = data.get("styles")

        if not name or not category or price is None:
            return jsonify({ "status": "fail", "message": "資料不完整" })

        inventory = load_json(INVENTORY_FILE)
        if name in inventory:
            return jsonify({ "status": "fail", "message": "商品已存在" })

        inventory[name] = {
            "name": name,
            "category": category,
            "price": price,
            "styles": styles if styles else None
        }

        save_json(INVENTORY_FILE, inventory)
        return jsonify({ "status": "success", "message": f"成功新增 {name}" })
    except Exception as e:
        return jsonify({ "status": "fail", "message": f"後端錯誤：{str(e)}" })



@app.route("/download/<filename>")
def download_file(filename):
    from flask import send_file
    path = os.path.join(".", filename)
    if os.path.exists(path):
        return send_file(path, as_attachment=True)
    return "檔案不存在", 404



@app.route("/api/log")
def api_log():
    if not os.path.exists(LOG_FILE):
        return jsonify([])
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        lines = f.readlines()
    return jsonify(lines)

@app.route("/main")
def main_page():
    if "staff_code" not in session:
        return "未登入", 401
    return render_template("main.html")

@app.route("/")
def login_page():
    return render_template("login.html")


@app.route("/api/logout")
def api_logout():
    session.pop("staff_code", None)
    session.pop("staff_name", None)
    return jsonify({ "status": "success", "message": "已登出" })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))  # 從 Render 提供的 PORT 環境變數取得 port
    app.run(host="0.0.0.0", port=port)
