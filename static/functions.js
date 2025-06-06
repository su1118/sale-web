let products = [];
let saleItems = [];
let saleIdentity = null;
let saleChannel = null;

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById('searchInput').addEventListener('input', () => {
    const keyword = document.getElementById('searchInput').value.trim().toLowerCase();
    const filtered = products.filter(p => p.name.toLowerCase().includes(keyword));
    renderProducts(filtered);
  });
  fetchData();
});

// ✅ 登入狀態檢查
  fetch("/main").then(res => {
    if (res.status === 401) {
      window.location.href = "/";
    }
  });

async function fetchData() {
  const response = await fetch('/api/products');
  products = await response.json();
  renderProducts(products);
}

const sizeOrder = ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "單一款式"];
function sortSizes(styles) {
  return Object.keys(styles).sort((a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b));
}


//查詢
function renderProducts(filtered) {
  const resultArea = document.getElementById('resultArea');
  resultArea.innerHTML = '';
  filtered.forEach(product => {
    const div = document.createElement('div');
    div.className = `product ${product.category}`;
    let html = `<h2>${product.name}</h2><div class="price">價格：$${product.price}</div>`;
    if (product.styles) {
      html += '<div class="inventory">';
          sortSizes(product.styles).forEach(size => {
      const stock = product.styles[size];
      html += `${size}：中心：${stock.center}　倉庫：${stock.warehouse}<br>`;
    });
      html += '</div>';
    } else {
      html += `<div class="inventory">中心：${product.center}　倉庫：${product.warehouse}</div>`;
    }
    div.innerHTML = html;
    resultArea.appendChild(div);
  });
}
async function fetchData() {
  const res = await fetch('/api/products');
  products = await res.json();

  // 建立分類選單
  const categories = [...new Set(products.map(p => p.category))];
  const select = document.getElementById('categoryFilter');
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });

  filterProducts(); // 初始顯示
}

function filterProducts() {
  const keyword = document.getElementById('searchInput').value.trim().toLowerCase();
  const category = document.getElementById('categoryFilter').value;
  const filtered = products.filter(p => {
    const matchKeyword = p.name.toLowerCase().includes(keyword);
    const matchCategory = category === '' || p.category === category;
    return matchKeyword && matchCategory;
  });
  renderProducts(filtered);
}




const identityOptions = {
  校友: '校友', 在校生: '在校生', 師長: '師長', 家長: '家長', 其他: '其他'
};
const channelOptions = {
  店面: '店面', 網路: '網路', 校內活動: '校內活動'
};


//銷售
async function handleSaleFlow() {
  saleItems = [];
  const categories = [...new Set(products.map(p => p.category || '未分類'))];

  const leftHtml = `
    <div style="width:60%; float:left; padding-right:3%; box-sizing:border-box; text-align:center">
      <div style="display:flex; justify-content:center; gap:10px; margin-bottom:10px">
        <select id="identity" class="swal2-input" style="width:48%">
          <option value="">選擇身分別</option>
          ${Object.keys(identityOptions).map(k => `<option value="${k}">${k}</option>`).join('')}
        </select>
        <select id="channel" class="swal2-input" style="width:48%">
          <option value="">選擇通路</option>
          ${Object.keys(channelOptions).map(k => `<option value="${k}">${k}</option>`).join('')}
        </select>
      </div>
      <select id="category" class="swal2-input" style="width:100%; margin-bottom:10px">
        <option value="">選擇分類</option>
        ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
      <div id="productArea" style="display:flex; flex-wrap:wrap; justify-content:center; gap:3px; margin-bottom:10px;"></div>
      <div id="styleArea" style="margin-bottom:10px"></div>
      <input type="number" id="qty" class="swal2-input" placeholder="輸入數量" min="1" style="max-width: 150px" />
      <button onclick="addSaleItem()" class="swal2-confirm swal2-styled" style="margin-top:10px; width:100%">➕ 新增商品</button>
    </div>
  `;

  const rightHtml = `
    <div style="width:40%; float:right; padding-left:3%; box-sizing:border-box; border-left:1px solid #ccc; height:500px; overflow:auto">
      <h3>即時預覽</h3>
      <ul id="salePreviewList" style="padding-left:1em"></ul>
      <hr>
      <strong id="salePreviewTotal"></strong><br>
      <button onclick="submitSaleItems()" class="swal2-confirm swal2-styled" style="margin-top:10px; width:100%">✅ 完成送出</button>
    </div>
  `;

  Swal.fire({
    title: '填寫銷售資料',
    html: `<div style="display:flex; max-width:1000px">${leftHtml}${rightHtml}</div>`,
    showConfirmButton: false,
    width: '70%',
    didOpen: () => {
      setupSaleForm();
    }
  });
}

function setupSaleForm() {
  const categorySelect = document.getElementById('category');
  const productArea = document.getElementById('productArea');
  const styleArea = document.getElementById('styleArea');

  categorySelect.addEventListener('change', () => {
    const selectedCategory = categorySelect.value;
    const items = products.filter(p => p.category === selectedCategory);
    productArea.innerHTML = items.map(p => {
      let total = p.styles ? Object.values(p.styles).reduce((s, i) => s + i.center + i.warehouse, 0) : p.center + p.warehouse;
      const disabled = total === 0 ? 'disabled' : '';
      const label = total === 0 ? `${p.name}（無庫存）` : p.name;
      return `<button class="product-btn" data-name="${p.name}" ${disabled}>${label}</button>`;
    }).join('');

    setTimeout(() => {
      document.querySelectorAll('.product-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const itemName = btn.dataset.name;
          const selected = items.find(p => p.name === itemName);
          styleArea.innerHTML = '';

          if (selected.styles) {
            const options = sortSizes(selected.styles).map(size => {
              const stock = selected.styles[size];
              const total = stock.center + stock.warehouse;
              const disabled = total === 0 ? 'disabled' : '';
              return `<option value="${size}" ${disabled}>${size}${total === 0 ? '（無庫存）' : ''}</option>`;
            }).join('');
            styleArea.innerHTML = `<select id="style" class="swal2-input">${options}</select>`;
          } else {
            styleArea.innerHTML = `<input type="hidden" id="style" value="">`;
          }
          styleArea.dataset.selected = JSON.stringify(selected);
        });
      });
    }, 0);
  });
}

function addSaleItem() {
  const identity = document.getElementById('identity').value;
  const channel = document.getElementById('channel').value;
  const qty = parseInt(document.getElementById('qty').value);
  const style = document.getElementById('style')?.value || '';
  const selected = JSON.parse(document.getElementById('styleArea').dataset.selected || '{}');
  if (!identity || !channel || !selected.name || !qty) {
    Swal.showValidationMessage('請填寫所有欄位'); return;
  }
  const discount = ['校友', '在校生', '師長'].includes(identity) ? 0.9 : 1.0;
  saleItems.push({
    name: selected.name,
    code: selected.code,
    category: selected.category,
    price: selected.price,
    style,
    qty,
    subtotal: selected.price * qty * discount,
    identity,
    channel,
    discount
  });
  updateSalePreview();
}

function updateSalePreview() {
  const list = document.getElementById('salePreviewList');
  list.innerHTML = '';
  let total = 0;
  saleItems.forEach((item, idx) => {
    total += item.subtotal;
    const li = document.createElement('li');
    li.innerHTML = `${item.name} ${item.style || ''} x${item.qty} = $${item.subtotal.toFixed(0)}
      <button onclick="removeSaleItem(${idx})">❌</button>`;
    list.appendChild(li);
  });
  document.getElementById('salePreviewTotal').textContent = `總計：$${total.toFixed(0)}`;
}

function removeSaleItem(index) {
  saleItems.splice(index, 1);
  updateSalePreview();
}

function submitSaleItems() {
  if (!saleItems.length) return;
  const identity = saleItems[0].identity;
  const channel = saleItems[0].channel;
  const discount = saleItems[0].discount;
  const total = saleItems.reduce((sum, i) => sum + i.subtotal, 0);

  Swal.fire({
    title: '輸入單號',
    input: 'text',
    customClass: {
      input: 'custom-input'
    },
    inputPlaceholder: '請輸入單號',
    showCancelButton: true
  }).then(result => {
    if (!result.isConfirmed || !result.value) return;
    const payload = {
      identity,
      channel,
      discount,
      total,
      order_id: result.value,
      items: saleItems,
      timestamp: new Date().toISOString()
    };
    fetch("/api/sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      Swal.fire('✅ 銷售完成', data.message || '成功送出', 'success');
      fetchData();
      saleItems = [];
    })
    .catch(err => {
      console.error(err);
      Swal.fire('❌ 發送失敗', '請檢查網路', 'error');
    });
  });
}


//退貨
async function handleReturnFlow() {
  saleItems = [];
  const categories = [...new Set(products.map(p => p.category || '未分類'))];

  const leftHtml = `
    <div style="width:60%; float:left; padding-right:3%; box-sizing:border-box; text-align:center">
      <div style="display:flex; justify-content:center; gap:10px; margin-bottom:10px">
        <select id="identity" class="swal2-input" style="width:48%">
          <option value="">選擇身分別</option>
          ${Object.keys(identityOptions).map(k => `<option value="${k}">${k}</option>`).join('')}
        </select>
        <select id="channel" class="swal2-input" style="width:48%">
          <option value="">選擇通路</option>
          ${Object.keys(channelOptions).map(k => `<option value="${k}">${k}</option>`).join('')}
        </select>
      </div>
      <select id="category" class="swal2-input" style="width:100%; margin-bottom:10px">
        <option value="">選擇分類</option>
        ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
      <div id="productArea" style="display:flex; flex-wrap:wrap; justify-content:center; gap:3px; margin-bottom:10px;"></div>
      <div id="styleArea" style="margin-bottom:10px"></div>
      <input type="number" id="qty" class="swal2-input" placeholder="輸入退貨數量" min="1" style="max-width:150px" />
      <button onclick="addReturnItem()" class="swal2-confirm swal2-styled" style="margin-top:10px; width:100%">➕ 新增退貨商品</button>
    </div>
  `;

  const rightHtml = `
    <div style="width:40%; float:right; padding-left:3%; box-sizing:border-box; border-left:1px solid #ccc; height:500px; overflow:auto">
      <h3>即時預覽</h3>
      <ul id="salePreviewList" style="padding-left:1em"></ul>
      <hr>
      <strong id="salePreviewTotal"></strong><br>
      <button onclick="submitReturnItems()" class="swal2-confirm swal2-styled" style="margin-top:10px; width:100%">✅ 完成送出</button>
    </div>
  `;

  Swal.fire({
    title: '填寫退貨資料',
    html: `<div style="display:flex; max-width:1000px">${leftHtml}${rightHtml}</div>`,
    showConfirmButton: false,
    width: '70%',
    didOpen: () => {
      setupReturnForm();
    }
  });
}

function setupReturnForm() {
  const categorySelect = document.getElementById('category');
  const productArea = document.getElementById('productArea');
  const styleArea = document.getElementById('styleArea');

  categorySelect.addEventListener('change', () => {
    const selectedCategory = categorySelect.value;
    const items = products.filter(p => p.category === selectedCategory);
    productArea.innerHTML = items.map(p => {
      const total = p.styles
        ? Object.values(p.styles).reduce((s, i) => s + i.center + i.warehouse, 0)
        : (p.center || 0) + (p.warehouse || 0);
      const disabled = total === 0 ? 'disabled' : '';
      const label = total === 0 ? `${p.name}（無庫存）` : p.name;
      return `<button class="product-btn" data-name="${p.name}" ${disabled}>${label}</button>`;
    }).join('');

    setTimeout(() => {
      document.querySelectorAll('.product-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const itemName = btn.dataset.name;
          const selected = products.find(p => p.name === itemName);
          styleArea.innerHTML = '';

          if (selected.styles) {
            const options = sortSizes(selected.styles).map(size => {
              const stock = selected.styles[size];
              const total = stock.center + stock.warehouse;
              const disabled = total === 0 ? 'disabled' : '';
              return `<option value="${size}" ${disabled}>${size}${total === 0 ? '（無庫存）' : ''}</option>`;
            }).join('');
            styleArea.innerHTML = `<select id="style" class="swal2-input">${options}</select>`;
          } else {
            styleArea.innerHTML = `<input type="hidden" id="style" value="">`;
          }
          styleArea.dataset.selected = JSON.stringify(selected);
        });
      });
    }, 0);
  });
}

function addReturnItem() {
  const identity = document.getElementById('identity').value;
  const channel = document.getElementById('channel').value;
  const qty = parseInt(document.getElementById('qty').value);
  const style = document.getElementById('style')?.value || '';
  const selected = JSON.parse(document.getElementById('styleArea').dataset.selected || '{}');
  if (!identity || !channel || !selected.name || !qty) {
    Swal.showValidationMessage('請填寫所有欄位');
    return;
  }

  const discount = ['校友', '在校生', '師長'].includes(identity) ? 0.9 : 1.0;
  saleItems.push({
    name: selected.name,
    code: selected.code,
    category: selected.category,
    price: selected.price,
    style,
    qty,
    subtotal: selected.price * qty * discount,
    type: 'return',
    identity,
    channel
  });

  updateSalePreview();
}

function updateSalePreview() {
  const list = document.getElementById('salePreviewList');
  list.innerHTML = '';
  let total = 0;
  saleItems.forEach((item, idx) => {
    total += item.subtotal;
    const li = document.createElement('li');
    li.innerHTML = `${item.name} ${item.style || ''} x${item.qty} = $${item.subtotal.toFixed(0)}
      <button onclick="removeSaleItem(${idx})">❌</button>`;
    list.appendChild(li);
  });
  document.getElementById('salePreviewTotal').textContent = `總計：$${total.toFixed(0)}`;
}

function removeSaleItem(index) {
  saleItems.splice(index, 1);
  updateSalePreview();
}

function submitReturnItems() {
  if (!saleItems.length) return;
  const identity = saleItems[0].identity;
  const channel = saleItems[0].channel;

  Swal.fire({
    title: '輸入單號',
    input: 'text',
    inputPlaceholder: '請輸入單號',
    customClass: { input: 'custom-input' },
    showCancelButton: true
  }).then(result => {
    if (!result.isConfirmed || !result.value) return;

    const payload = {
      order_id: result.value,
      timestamp: new Date().toISOString(),
      identity,
      channel,
      items: saleItems
    };

    fetch("/api/return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      Swal.fire('✅ 退貨完成', data.message || '已提交資料', 'success');
      fetchData();
      saleItems = [];
    })
    .catch(err => {
      console.error(err);
      Swal.fire('❌ 發送失敗', '請檢查伺服器或網路', 'error');
    });
  });
}


//換貨
let oldExchangeItems = [];
let newExchangeItems = [];
let exchangeIdentity = '';
let exchangeChannel = '';


async function handleExchangeFlow() {
  oldExchangeItems = [];
  newExchangeItems = [];

  const categories = [...new Set(products.map(p => p.category || '未分類'))];
  const leftHtml = `
    <div style="width:60%; float:left; padding-right:3%; box-sizing:border-box; text-align:center">
      <div style="display:flex; justify-content:center; gap:10px; margin-bottom:10px">
        <select id="identity" class="swal2-input" style="width:48%">
          <option value="">選擇身分別</option>
          ${Object.keys(identityOptions).map(k => `<option value="${k}">${k}</option>`).join('')}
        </select>
        <select id="channel" class="swal2-input" style="width:48%">
          <option value="">選擇通路</option>
          ${Object.keys(channelOptions).map(k => `<option value="${k}">${k}</option>`).join('')}
        </select>
      </div>
      <select id="category" class="swal2-input" style="width:100%; margin-bottom:10px">
        <option value="">選擇分類</option>
        ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
      <div id="productArea" style="display:flex; flex-wrap:wrap; justify-content:center; gap:3px; margin-bottom:10px;"></div>
      <div id="styleArea" style="margin-bottom:10px"></div>
      <input type="number" id="qty" class="swal2-input" placeholder="輸入退貨數量" min="1" style="max-width: 150px" />
      <button onclick="addExchangeOldItem()" class="swal2-confirm swal2-styled" style="margin-top:10px; width:100%">➕ 新增退貨商品</button>
    </div>
  `;
  const rightHtml = `
    <div style="width:40%; float:right; padding-left:3%; box-sizing:border-box; border-left:1px solid #ccc; height:500px; overflow:auto; text-align:center">
      <h3>退貨預覽</h3>
      <ul id="oldPreviewList" style="padding-left:1em"></ul>
      <hr>
      <strong id="oldPreviewTotal"></strong><br>
      <button onclick="proceedToExchangeNew()" class="swal2-confirm swal2-styled" style="margin-top:10px; width:100%">➡️ 下一步</button>
    </div>
  `;

  Swal.fire({
    title: '換貨 - 退貨商品',
    html: `<div style="display:flex; max-width:1000px">${leftHtml}${rightHtml}</div>`,
    showConfirmButton: false,
    width: '70%',
    didOpen: () => {
      setupProductSelectForm(oldExchangeItems, 'old');
    }
  });
}

function addExchangeOldItem() {
  const identity = document.getElementById('identity').value;
  const channel = document.getElementById('channel').value;
  if (!identity || !channel) {
    Swal.showValidationMessage('請選擇身分別與通路');
    return;
  }
  exchangeIdentity = identity;
  exchangeChannel = channel;

  const qty = parseInt(document.getElementById('qty').value);
  const style = document.getElementById('style')?.value || '';
  const selected = JSON.parse(document.getElementById('styleArea').dataset.selected || '{}');
  if (!selected.name || !qty) {
    Swal.showValidationMessage('請選擇商品與數量');
    return;
  }

  const discount = ['校友', '在校生', '師長'].includes(identity) ? 0.9 : 1.0;

  oldExchangeItems.push({
    name: selected.name,
    code: selected.code,
    category: selected.category,
    price: selected.price,
    style,
    qty,
    subtotal: selected.price * qty * discount,
    type: 'exchange_in'
  });
  updateExchangePreview('old', oldExchangeItems);
}


function proceedToExchangeNew() {
  if (!oldExchangeItems.length) return;
  showExchangeNewStep();
}

async function showExchangeNewStep() {
  const categories = [...new Set(products.map(p => p.category || '未分類'))];
  const leftHtml = `
    <div style="width:60%; float:left; padding-right:3%; box-sizing:border-box; text-align:center">
      <select id="category" class="swal2-input" style="width:100%; margin-bottom:10px">
        <option value="">選擇分類</option>
        ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
      <div id="productArea" style="display:flex; flex-wrap:wrap; justify-content:center; gap:3px; margin-bottom:10px;"></div>
      <div id="styleArea" style="margin-bottom:10px"></div>
      <input type="number" id="qty" class="swal2-input" placeholder="輸入換貨數量" min="1" style="max-width: 150px" />
      <button onclick="addExchangeNewItem()" class="swal2-confirm swal2-styled" style="margin-top:10px; width:100%">➕ 新增換貨商品</button>
    </div>
  `;
  const rightHtml = `
    <div style="width:40%; float:right; padding-left:3%; box-sizing:border-box; border-left:1px solid #ccc; height:500px; overflow:auto; text-align:center">
      <h3>換貨預覽</h3>
      <ul id="newPreviewList" style="padding-left:1em"></ul>
      <hr>
      <strong id="newPreviewTotal"></strong><br>
      <button onclick="confirmExchangeDifference()" class="swal2-confirm swal2-styled" style="margin-top:10px; width:100%">➡️ 下一步</button>
    </div>
  `;
  Swal.fire({
    title: '換貨 - 換出商品',
    html: `<div style="display:flex; max-width:1000px">${leftHtml}${rightHtml}</div>`,
    showConfirmButton: false,
    width: '70%',
    didOpen: () => {
      setupProductSelectForm(newExchangeItems, 'new');
    }
  });
}

function addExchangeNewItem() {
  const qty = parseInt(document.getElementById('qty').value);
  const style = document.getElementById('style')?.value || '';
  const selected = JSON.parse(document.getElementById('styleArea').dataset.selected || '{}');
  if (!selected.name || !qty) {
    Swal.showValidationMessage('請選擇商品與數量');
    return;
  }

  const discount = ['校友', '在校生', '師長'].includes(exchangeIdentity) ? 0.9 : 1.0;

  newExchangeItems.push({
    name: selected.name,
    code: selected.code,
    category: selected.category,
    price: selected.price,
    style,
    qty,
    subtotal: selected.price * qty * discount,
    type: 'exchange_out'
  });
  updateExchangePreview('new', newExchangeItems);
}


function confirmExchangeDifference() {
  const totalOld = oldExchangeItems.reduce((sum, i) => sum + i.subtotal, 0);
  const totalNew = newExchangeItems.reduce((sum, i) => sum + i.subtotal, 0);
  const diff = (totalNew - totalOld).toFixed(0);
  const html = `
    <div style="text-align:center">
      <p>退貨總額：$${totalOld.toFixed(0)}</p>
      <p>換貨總額：$${totalNew.toFixed(0)}</p>
      <p><strong>差額：$${diff}</strong></p>
    </div>
  `;
  Swal.fire({
    title: '差額確認',
    html,
    confirmButtonText: '確認完成',
    showCancelButton: true
  }).then(res => {
    if (res.isConfirmed) {
      submitExchangeOrder();
    }
  });
}

function submitExchangeOrder() {
  Swal.fire({
    title: '輸入單號',
    input: 'text',
    inputPlaceholder: '請輸入單號',
    customClass: { input: 'custom-input' },
    showCancelButton: true
  }).then(result => {
    if (!result.isConfirmed || !result.value) return;
    const payload = {
      order_id: result.value,
      timestamp: new Date().toISOString(),
      identity: exchangeIdentity,
      channel: exchangeChannel,
      items: [...oldExchangeItems, ...newExchangeItems]
    };
    fetch("/api/return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      Swal.fire('✅ 換貨完成', data.message || '已提交資料', 'success');
      fetchData();
    })
    .catch(err => {
      console.error(err);
      Swal.fire('❌ 發送失敗', '請檢查伺服器或網路', 'error');
    });
  });
}

function updateExchangePreview(type, items) {
  const listId = type === 'old' ? 'oldPreviewList' : 'newPreviewList';
  const totalId = type === 'old' ? 'oldPreviewTotal' : 'newPreviewTotal';
  const list = document.getElementById(listId);
  const total = items.reduce((sum, i) => sum + i.subtotal, 0);

  list.innerHTML = '';
  items.forEach((item, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `${item.name} ${item.style || ''} x${item.qty} = $${item.subtotal.toFixed(0)}
      <button onclick="${type === 'old' ? `removeOldItem(${idx})` : `removeNewItem(${idx})`}">❌</button>`;
    list.appendChild(li);
  });
  document.getElementById(totalId).textContent = `總計：$${total.toFixed(0)}`;
}

function removeOldItem(index) {
  oldExchangeItems.splice(index, 1);
  updateExchangePreview('old', oldExchangeItems);
}
function removeNewItem(index) {
  newExchangeItems.splice(index, 1);
  updateExchangePreview('new', newExchangeItems);
}

function setupProductSelectForm(targetArray, type) {
  const categorySelect = document.getElementById('category');
  const productArea = document.getElementById('productArea');
  const styleArea = document.getElementById('styleArea');

  categorySelect.addEventListener('change', () => {
    const selectedCategory = categorySelect.value;
    const items = products.filter(p => p.category === selectedCategory);
    productArea.innerHTML = items.map(p => {
      let total = p.styles ? Object.values(p.styles).reduce((s, i) => s + i.center, 0) : p.center;
      const disabled = total === 0 ? 'disabled' : '';
      const label = total === 0 ? `${p.name}（無庫存）` : p.name;
      return `<button class="product-btn" data-name="${p.name}" ${disabled}>${label}</button>`;
    }).join('');

    setTimeout(() => {
      document.querySelectorAll('.product-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const itemName = btn.dataset.name;
          const selected = items.find(p => p.name === itemName);
          styleArea.innerHTML = '';

          if (selected.styles) {
            const options = sortSizes(selected.styles).map(size => {
              const stock = selected.styles[size];
              const total = stock.center;
              const disabled = total === 0 ? 'disabled' : '';
              return `<option value="${size}" ${disabled}>${size}${total === 0 ? '（無庫存）' : ''}</option>`;
            }).join('');
            styleArea.innerHTML = `<select id="style" class="swal2-input">${options}</select>`;
          } else {
            styleArea.innerHTML = `<input type="hidden" id="style" value="">`;
          }
          styleArea.dataset.selected = JSON.stringify(selected);
        });
      });
    }, 0);
  });
}


//贈與
async function handleGiftFlow() {
  let giftItems = [];

  async function addGiftItem() {
    const categories = [...new Set(products.map(p => p.category || '未分類'))];

    const leftHtml = `
      <div style="width:60%; float:left; padding-right:3%; box-sizing:border-box; text-align:center">
        <select id="category" class="swal2-input" style="width:100%; margin-bottom:10px">
          <option value="">選擇分類</option>
          ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <div id="productArea" style="display:flex; flex-wrap:wrap; justify-content:center; gap:3px; margin-bottom:10px;"></div>
        <div id="styleArea" style="margin-bottom:10px"></div>
        <input type="number" id="qty" class="swal2-input" placeholder="輸入數量" min="1" style="max-width: 150px" />
        <button onclick="confirmGiftItem()" class="swal2-confirm swal2-styled" style="margin-top:10px; width:100%">➕ 新增商品</button>
      </div>
    `;

    const rightHtml = `
      <div style="width:40%; float:right; padding-left:3%; box-sizing:border-box; border-left:1px solid #ccc; height:500px; overflow:auto; text-align:center">
        <h3>即時預覽</h3>
        <ul id="giftPreviewList" style="padding-left:1em"></ul>
        <hr>
        <strong id="giftPreviewTotal"></strong><br>
        <button onclick="askGiftReason()" class="swal2-confirm swal2-styled" style="margin-top:10px; width:100%">✅ 完成送出</button>
      </div>
    `;

    Swal.fire({
      title: '贈與',
      html: `<div style="display:flex; max-width:1000px">${leftHtml}${rightHtml}</div>`,
      showConfirmButton: false,
      width: '70%',
      didOpen: () => {
        setupGiftForm();
      }
    });
  }

  function setupGiftForm() {
    const categorySelect = document.getElementById('category');
    const productArea = document.getElementById('productArea');
    const styleArea = document.getElementById('styleArea');

    categorySelect.addEventListener('change', () => {
      const selectedCategory = categorySelect.value;
      const items = products.filter(p => p.category === selectedCategory);
      productArea.innerHTML = items.map(p => {
        let total = p.styles ? Object.values(p.styles).reduce((s, i) => s + i.center + i.warehouse, 0) : p.center + p.warehouse;
        const disabled = total === 0 ? 'disabled' : '';
        const label = total === 0 ? `${p.name}（無庫存）` : p.name;
        return `<button class="product-btn" data-name="${p.name}" ${disabled}>${label}</button>`;
      }).join('');

      setTimeout(() => {
        document.querySelectorAll('.product-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const itemName = btn.dataset.name;
            const selected = products.find(p => p.name === itemName);
            styleArea.innerHTML = '';

            if (selected.styles) {
              const options = sortSizes(selected.styles).map(size => {
                const stock = selected.styles[size];
                const total = stock.center + stock.warehouse;
                const disabled = total === 0 ? 'disabled' : '';
                return `<option value="${size}" ${disabled}>${size}${total === 0 ? '（無庫存）' : ''}</option>`;
              }).join('');
              styleArea.innerHTML = `<select id="style" class="swal2-input">${options}</select>`;
            } else {
              styleArea.innerHTML = `<input type="hidden" id="style" value="">`;
            }
            styleArea.dataset.selected = JSON.stringify(selected);
          });
        });
      }, 0);
    });
  }

  window.confirmGiftItem = function () {
    const qty = parseInt(document.getElementById('qty').value);
    const style = document.getElementById('style')?.value || '';
    const selected = JSON.parse(document.getElementById('styleArea').dataset.selected || '{}');
    if (!selected.name || !qty) {
      Swal.showValidationMessage('請選擇商品與數量');
      return;
    }
    giftItems.push({
      name: selected.name,
      code: selected.code,
      category: selected.category,
      price: 0,
      style,
      qty
    });
    updateGiftPreview();
  }

  function updateGiftPreview() {
    const list = document.getElementById('giftPreviewList');
    list.innerHTML = '';
    giftItems.forEach((item, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `${item.name} ${item.style || ''} x${item.qty} <button onclick="removeGiftItem(${idx})">❌</button>`;
      list.appendChild(li);
    });
    document.getElementById('giftPreviewTotal').textContent = `共 ${giftItems.length} 筆`;
  }

  window.removeGiftItem = function (index) {
    giftItems.splice(index, 1);
    updateGiftPreview();
  }

  window.askGiftReason = function () {
    if (!giftItems.length) return;
    Swal.fire({
      title: '輸入贈與人',
      input: 'text',
      inputPlaceholder: '例如：張書銜學長',
      showCancelButton: true,
      confirmButtonText: '預覽送出',
      cancelButtonText: '取消',
      customClass: { input: 'custom-input' }
    }).then(result => {
      if (!result.isConfirmed || !result.value) return;
      const reason = result.value;
      let html = '<ul>';
      giftItems.forEach(item => {
        html += `<li>${item.name} ${item.style || ''} x ${item.qty}</li>`;
      });
      html += '</ul>';

      Swal.fire({
        title: '送出確認',
        html: html + `<br>用途：${reason}`,
        showCancelButton: true,
        confirmButtonText: '送出',
        cancelButtonText: '返回'
      }).then(res => {
        if (res.isConfirmed) {
          submitGiftToBackend(giftItems, reason);
        }
      });
    });
  };


  function submitGiftToBackend(items, reason) {
    const payload = {
      items,
      reason,
      timestamp: new Date().toISOString()
    };
    fetch("/api/gift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      Swal.fire("✅ 完成", data.message || "資料已送出", "success");
      fetchData();
    })
    .catch(err => {
      console.error(err);
      Swal.fire("❌ 發送失敗", "請確認伺服器狀況", "error");
    });
  }

  addGiftItem();
}


//工用
async function handleWorkerFlow() {
  let giftItems = [];

  async function addGiftItem() {
    const categories = [...new Set(products.map(p => p.category || '未分類'))];

    const leftHtml = `
      <div style="width:60%; float:left; padding-right:3%; box-sizing:border-box; text-align:center">
        <select id="category" class="swal2-input" style="width:100%; margin-bottom:10px">
          <option value="">選擇分類</option>
          ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <div id="productArea" style="display:flex; flex-wrap:wrap; justify-content:center; gap:3px; margin-bottom:10px;"></div>
        <div id="styleArea" style="margin-bottom:10px"></div>
        <input type="number" id="qty" class="swal2-input" placeholder="輸入數量" min="1" style="max-width: 150px" />
        <button onclick="confirmGiftItem()" class="swal2-confirm swal2-styled" style="margin-top:10px; width:100%">➕ 新增商品</button>
      </div>
    `;

    const rightHtml = `
      <div style="width:40%; float:right; padding-left:3%; box-sizing:border-box; border-left:1px solid #ccc; height:500px; overflow:auto; text-align:center">
        <h3>即時預覽</h3>
        <ul id="giftPreviewList" style="padding-left:1em"></ul>
        <hr>
        <strong id="giftPreviewTotal"></strong><br>
        <button onclick="askGiftReason()" class="swal2-confirm swal2-styled" style="margin-top:10px; width:100%">✅ 完成送出</button>
      </div>
    `;

    Swal.fire({
      title: '工用',
      html: `<div style="display:flex; max-width:1000px">${leftHtml}${rightHtml}</div>`,
      showConfirmButton: false,
      width: '70%',
      didOpen: () => {
        setupGiftForm();
      }
    });
  }

  function setupGiftForm() {
    const categorySelect = document.getElementById('category');
    const productArea = document.getElementById('productArea');
    const styleArea = document.getElementById('styleArea');

    categorySelect.addEventListener('change', () => {
      const selectedCategory = categorySelect.value;
      const items = products.filter(p => p.category === selectedCategory);
      productArea.innerHTML = items.map(p => {
        let total = p.styles ? Object.values(p.styles).reduce((s, i) => s + i.center + i.warehouse, 0) : p.center + p.warehouse;
        const disabled = total === 0 ? 'disabled' : '';
        const label = total === 0 ? `${p.name}（無庫存）` : p.name;
        return `<button class="product-btn" data-name="${p.name}" ${disabled}>${label}</button>`;
      }).join('');

      setTimeout(() => {
        document.querySelectorAll('.product-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const itemName = btn.dataset.name;
            const selected = products.find(p => p.name === itemName);
            styleArea.innerHTML = '';

            if (selected.styles) {
              const options = sortSizes(selected.styles).map(size => {
                const stock = selected.styles[size];
                const total = stock.center + stock.warehouse;
                const disabled = total === 0 ? 'disabled' : '';
                return `<option value="${size}" ${disabled}>${size}${total === 0 ? '（無庫存）' : ''}</option>`;
              }).join('');
              styleArea.innerHTML = `<select id="style" class="swal2-input">${options}</select>`;
            } else {
              styleArea.innerHTML = `<input type="hidden" id="style" value="">`;
            }
            styleArea.dataset.selected = JSON.stringify(selected);
          });
        });
      }, 0);
    });
  }

  window.confirmGiftItem = function () {
    const qty = parseInt(document.getElementById('qty').value);
    const style = document.getElementById('style')?.value || '';
    const selected = JSON.parse(document.getElementById('styleArea').dataset.selected || '{}');
    if (!selected.name || !qty) {
      Swal.showValidationMessage('請選擇商品與數量');
      return;
    }
    giftItems.push({
      name: selected.name,
      code: selected.code,
      category: selected.category,
      price: 0,
      style,
      qty
    });
    updateGiftPreview();
  }

  function updateGiftPreview() {
    const list = document.getElementById('giftPreviewList');
    list.innerHTML = '';
    giftItems.forEach((item, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `${item.name} ${item.style || ''} x${item.qty} <button onclick="removeGiftItem(${idx})">❌</button>`;
      list.appendChild(li);
    });
    document.getElementById('giftPreviewTotal').textContent = `共 ${giftItems.length} 筆`;
  }

  window.removeGiftItem = function (index) {
    giftItems.splice(index, 1);
    updateGiftPreview();
  }

  window.askGiftReason = function () {
    if (!giftItems.length) return;
    Swal.fire({
      title: '輸入用途',
      input: 'text',
      inputPlaceholder: '例如：樣品',
      showCancelButton: true,
      confirmButtonText: '預覽送出',
      cancelButtonText: '取消',
      customClass: { input: 'custom-input' }
    }).then(result => {
      if (!result.isConfirmed || !result.value) return;
      const reason = result.value;
      let html = '<ul>';
      giftItems.forEach(item => {
        html += `<li>${item.name} ${item.style || ''} x ${item.qty}</li>`;
      });
      html += '</ul>';

      Swal.fire({
        title: '送出確認',
        html: html + `<br>用途：${reason}`,
        showCancelButton: true,
        confirmButtonText: '送出',
        cancelButtonText: '返回'
      }).then(res => {
        if (res.isConfirmed) {
          submitGiftToBackend(giftItems, reason);
        }
      });
    });
  };


  function submitGiftToBackend(items, reason) {
    const payload = {
      items,
      reason,
      timestamp: new Date().toISOString()
    };
    fetch("/api/gift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      Swal.fire("✅ 完成", data.message || "資料已送出", "success");
      fetchData();
    })
    .catch(err => {
      console.error(err);
      Swal.fire("❌ 發送失敗", "請確認伺服器狀況", "error");
    });
  }

  addGiftItem();
}



//調貨
async function handleTransferFlow() {
  let transferItems = [];
  const categories = [...new Set(products.map(p => p.category || '未分類'))];

  const leftHtml = `
    <div style="width:60%; float:left; padding-right:3%; box-sizing:border-box; text-align:center">
      <select id="category" class="swal2-input" style="width:100%; margin-bottom:10px">
        <option value="">選擇分類</option>
        ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
      <div id="productArea" style="display:flex; flex-wrap:wrap; justify-content:center; gap:3px; margin-bottom:10px;"></div>
      <div id="styleArea" style="margin-bottom:10px"></div>
      <input type="number" id="qty" class="swal2-input" placeholder="輸入數量" min="1" style="max-width:150px" />
      <button onclick="addTransferItem()" class="swal2-confirm swal2-styled" style="margin-top:10px; width:100%">➕ 新增商品</button>
    </div>
  `;

  const rightHtml = `
    <div style="width:40%; float:right; padding-left:3%; box-sizing:border-box; border-left:1px solid #ccc; height:500px; overflow:auto; text-align:center">
      <h3>即時預覽</h3>
      <ul id="transferPreviewList" style="padding-left:1em"></ul>
      <hr>
      <strong id="transferPreviewTotal"></strong><br>
      <button onclick="submitTransferItems()" class="swal2-confirm swal2-styled" style="margin-top:10px; width:100%">✅ 完成送出</button>
    </div>
  `;

  Swal.fire({
    title: '調貨作業',
    html: `<div style="display:flex; max-width:1000px">${leftHtml}${rightHtml}</div>`,
    showConfirmButton: false,
    width: '70%',
    didOpen: () => {
      setupTransferForm();
    },
    willOpen: () => {
      Swal.resetValidationMessage();
    }
  });

  function setupTransferForm() {
    const categorySelect = document.getElementById('category');
    const productArea = document.getElementById('productArea');
    const styleArea = document.getElementById('styleArea');

    categorySelect.addEventListener('change', () => {
      const selectedCategory = categorySelect.value;
      const items = products.filter(p => p.category === selectedCategory);
      productArea.innerHTML = items.map(p => {
        let total = p.styles ? Object.values(p.styles).reduce((s, i) => s + i.warehouse, 0) : p.warehouse;
        const disabled = total === 0 ? 'disabled' : '';
        const label = total === 0 ? `${p.name}（無庫存）` : p.name;
        return `<button class="product-btn" data-name="${p.name}" ${disabled}>${label}</button>`;
      }).join('');

      setTimeout(() => {
        document.querySelectorAll('.product-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const itemName = btn.dataset.name;
            const selected = items.find(p => p.name === itemName);
            styleArea.innerHTML = '';

            if (selected.styles) {
              const options = sortSizes(selected.styles).map(size => {
                const stock = selected.styles[size];
                const total = stock.warehouse;
                const disabled = total === 0 ? 'disabled' : '';
                return `<option value="${size}" ${disabled}>${size}${total === 0 ? '（無庫存）' : ''}</option>`;
              }).join('');
              styleArea.innerHTML = `<select id="style" class="swal2-input">${options}</select>`;
            } else {
              styleArea.innerHTML = `<input type="hidden" id="style" value="">`;
            }
            styleArea.dataset.selected = JSON.stringify(selected);
          });
        });
      }, 0);
    });
  }

  window.addTransferItem = function () {
    const qty = parseInt(document.getElementById('qty').value);
    const style = document.getElementById('style')?.value || '';
    const selected = JSON.parse(document.getElementById('styleArea').dataset.selected || '{}');
    if (!selected.name || !qty) {
      Swal.showValidationMessage('請選擇商品與數量');
      return;
    }
    transferItems.push({
      name: selected.name,
      code: selected.code,
      category: selected.category,
      style,
      qty
    });
    updateTransferPreview();
  }

  window.updateTransferPreview = function () {
    const list = document.getElementById('transferPreviewList');
    list.innerHTML = '';
    transferItems.forEach((item, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `${item.name} ${item.style || ''} x${item.qty} <button onclick="removeTransferItem(${idx})">❌</button>`;
      list.appendChild(li);
    });
    document.getElementById('transferPreviewTotal').textContent = `共 ${transferItems.length} 筆`;
  }

  window.removeTransferItem = function (index) {
    transferItems.splice(index, 1);
    updateTransferPreview();
  }

  window.submitTransferItems = function () {
    if (!transferItems.length) return;
    const payload = {
      timestamp: new Date().toISOString(),
      items: transferItems
    };

    fetch("/api/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      Swal.fire("✅ 調貨完成", data.message || "資料已送出", "success");
      fetchData();
    })
    .catch(err => {
      console.error(err);
      Swal.fire("❌ 發送失敗", "請確認伺服器狀況", "error");
    });
  }
}



//補貨
async function handleRestockFlow() {
  let restockItems = [];
  const categories = [...new Set(products.map(p => p.category || '未分類'))];

  const leftHtml = `
    <div style="width:60%; float:left; padding-right:3%; box-sizing:border-box; text-align:center">
      <select id="category" class="swal2-input" style="width:100%; margin-bottom:10px">
        <option value="">選擇分類</option>
        ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
      <div id="productArea" style="display:flex; flex-wrap:wrap; justify-content:center; gap:3px; margin-bottom:10px;"></div>
      <div id="styleArea" style="margin-bottom:10px;"></div>
      <input type="number" id="qty" class="swal2-input" placeholder="補貨數量" min="1" style="max-width:150px" />
      <button onclick="addRestockItem()" class="swal2-confirm swal2-styled" style="margin-top:10px; width:100%">➕ 新增商品</button>
    </div>
  `;

  const rightHtml = `
    <div style="width:40%; float:right; padding-left:3%; box-sizing:border-box; border-left:1px solid #ccc; height:500px; overflow:auto; text-align:center">
      <h3>即時預覽</h3>
      <ul id="restockPreviewList" style="padding-left:1em"></ul>
      <hr>
      <strong id="restockPreviewTotal"></strong><br>
      <button onclick="submitRestockItems()" class="swal2-confirm swal2-styled" style="margin-top:10px; width:100%">✅ 完成送出</button>
    </div>
  `;

  Swal.fire({
    title: '補貨作業',
    html: `<div style="display:flex; max-width:1000px">${leftHtml}${rightHtml}</div>`,
    showConfirmButton: false,
    width: '70%',
    willOpen: () => Swal.resetValidationMessage(),
    didOpen: () => setupRestockForm()
  });

  function setupRestockForm() {
    const categorySelect = document.getElementById('category');
    const productArea = document.getElementById('productArea');
    const styleArea = document.getElementById('styleArea');

    categorySelect.addEventListener('change', () => {
      const selectedCategory = categorySelect.value;
      const items = products.filter(p => p.category === selectedCategory);
      productArea.innerHTML = items.map(p => {
        return `<button class="product-btn" data-name="${p.name}">${p.name}</button>`;
      }).join('');

      setTimeout(() => {
        document.querySelectorAll('.product-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const itemName = btn.dataset.name;
            const selected = items.find(p => p.name === itemName);
            styleArea.innerHTML = '';

            if (selected.styles) {
              const options = sortSizes(selected.styles).map(size => {
                return `<option value="${size}">${size}</option>`;
              }).join('');
              styleArea.innerHTML = `<select id="style" class="swal2-input">${options}</select>`;
            } else {
              styleArea.innerHTML = `<input type="hidden" id="style" value="">`;
            }
            styleArea.dataset.selected = JSON.stringify(selected);
          });
        });
      }, 0);
    });
  }

  window.addRestockItem = function () {
    const qty = parseInt(document.getElementById('qty').value);
    const style = document.getElementById('style')?.value || '';
    const selected = JSON.parse(document.getElementById('styleArea').dataset.selected || '{}');
    if (!selected.name || !qty) {
      Swal.showValidationMessage('請選擇商品與數量');
      return;
    }
    restockItems.push({
      name: selected.name,
      code: selected.code,
      category: selected.category,
      style,
      qty
    });
    updateRestockPreview();
  }

  window.updateRestockPreview = function () {
    const list = document.getElementById('restockPreviewList');
    list.innerHTML = '';
    restockItems.forEach((item, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `${item.name} ${item.style || ''} x${item.qty} <button onclick="removeRestockItem(${idx})">❌</button>`;
      list.appendChild(li);
    });
    document.getElementById('restockPreviewTotal').textContent = `共 ${restockItems.length} 筆`;
  }

  window.removeRestockItem = function (index) {
    restockItems.splice(index, 1);
    updateRestockPreview();
  }

  window.submitRestockItems = function () {
    if (!restockItems.length) return;
    const payload = {
      timestamp: new Date().toISOString(),
      items: restockItems
    };
    fetch("/api/restock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      Swal.fire("✅ 補貨完成", data.message || "資料已送出", "success");
      fetchData();
    })
    .catch(err => {
      console.error(err);
      Swal.fire("❌ 發送失敗", "請確認伺服器狀況", "error");
    });
  }
}


//活動
async function handleActivityFlow() {
  let activityItems = [];
  const response = await fetch('/api/activity-products');
  const activityProducts = await response.json();
  const products = Object.values(activityProducts);
  const categories = [...new Set(products.map(p => p.category || '未分類'))];

  const leftHtml = `
    <div style="width:60%; float:left; padding-right:3%; box-sizing:border-box; text-align:center">
      <select id="identity" class="swal2-input" style="width:100%; margin-bottom:10px">
        <option value="">選擇身分別</option>
        <option value="校友">校友</option>
        <option value="在校生">在校生</option>
        <option value="師長">師長</option>
        <option value="家長">家長</option>
        <option value="其他">其他</option>
      </select>
      <select id="category" class="swal2-input" style="width:100%; margin-bottom:10px">
        <option value="">選擇分類</option>
        ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
      <div id="productArea" style="display:flex; flex-wrap:wrap; justify-content:center; gap:3px; margin-bottom:10px;"></div>
      <div id="styleArea" style="margin-bottom:10px"></div>
      <input type="number" id="qty" class="swal2-input" placeholder="輸入數量" min="1" style="max-width:150px" />
      <button onclick="addActivityItem()" class="swal2-confirm swal2-styled" style="margin-top:10px; width:100%">➕ 新增商品</button>
    </div>
  `;

  const rightHtml = `
    <div style="width:40%; float:right; padding-left:3%; box-sizing:border-box; border-left:1px solid #ccc; height:500px; overflow:auto; text-align:center">
      <h3>活動預覽</h3>
      <ul id="activityPreviewList" style="padding-left:1em"></ul>
      <hr>
      <strong id="activityPreviewTotal"></strong><br>
      <button onclick="submitActivityItems()" class="swal2-confirm swal2-styled" style="margin-top:10px; width:100%">✅ 完成送出</button>
    </div>
  `;

  Swal.fire({
    title: '活動銷售',
    html: `<div style="display:flex; max-width:1000px">${leftHtml}${rightHtml}</div>`,
    showConfirmButton: false,
    width: '70%',
    didOpen: () => {
      setupActivityForm();
    }
  });

  window.setupActivityForm = function () {
    const categorySelect = document.getElementById('category');
    const productArea = document.getElementById('productArea');
    const styleArea = document.getElementById('styleArea');

    categorySelect.addEventListener('change', () => {
      const selectedCategory = categorySelect.value;
      const items = products.filter(p => p.category === selectedCategory);
      productArea.innerHTML = items.map(p => {
        const total = Object.values(p.styles).reduce((sum, s) => sum + s.center + s.warehouse, 0);
        const disabled = total === 0 ? 'disabled' : '';
        const label = total === 0 ? `${p.name}（無庫存）` : p.name;
        return `<button class="product-btn" data-name="${p.name}" ${disabled}>${label}</button>`;
      }).join('');

      setTimeout(() => {
        document.querySelectorAll('.product-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const itemName = btn.dataset.name;
            const selected = products.find(p => p.name === itemName);
            const styleOptions = sortSizes(selected.styles).map(size => {
              const stock = selected.styles[size];
              const total = stock.center + stock.warehouse;
              const disabled = total === 0 ? 'disabled' : '';
              return `<option value="${size}" ${disabled}>${size}${total === 0 ? '（無庫存）' : ''}</option>`;
            }).join('');
            styleArea.innerHTML = `<select id="style" class="swal2-input">${styleOptions}</select>`;
            styleArea.dataset.selected = JSON.stringify(selected);
          });
        });
      }, 0);
    });
  };

  window.addActivityItem = function () {
    const identity = document.getElementById('identity').value;
    const qty = parseInt(document.getElementById('qty').value);
    const style = document.getElementById('style')?.value || '';
    const selected = JSON.parse(document.getElementById('styleArea').dataset.selected || '{}');
    if (!identity || !selected.name || !qty) {
      Swal.showValidationMessage('請選擇身分別、商品與數量'); return;
    }
    activityItems.push({
      name: selected.name,
      code: selected.code,
      category: selected.category,
      style,
      qty,
      price: selected.price,
      subtotal: selected.price * qty,
      identity
    });
    updateActivityPreview();
  };

  window.updateActivityPreview = function () {
    const list = document.getElementById('activityPreviewList');
    list.innerHTML = '';
    let total = 0;
    activityItems.forEach((item, idx) => {
      total += item.subtotal;
      const li = document.createElement('li');
      li.innerHTML = `${item.name} ${item.style || ''} x${item.qty} = $${item.subtotal} <button onclick="removeActivityItem(${idx})">❌</button>`;
      list.appendChild(li);
    });
    document.getElementById('activityPreviewTotal').textContent = `總金額：$${total}`;
  };

  window.removeActivityItem = function (index) {
    activityItems.splice(index, 1);
    updateActivityPreview();
  };

  window.submitActivityItems = function () {
    if (!activityItems.length) return;
    Swal.fire({
      title: '輸入單號',
      input: 'text',
      inputPlaceholder: '請輸入單號',
      customClass: { input: 'custom-input' },
      showCancelButton: true,
      confirmButtonText: '送出',
      cancelButtonText: '取消'
    }).then(result => {
      if (!result.isConfirmed || !result.value) return;
      const payload = {
        order_id: result.value,
        identity: activityItems[0].identity,
        timestamp: new Date().toISOString(),
        items: activityItems.map(item => ({
          code: item.code,
          name: item.name,
          category: item.category,
          style: item.style,
          qty: item.qty,
          price: item.price
        }))
      };
      fetch("/api/activity-sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      .then(res => res.json())
      .then(data => {
        Swal.fire("✅ 已完成活動銷售", data.message || "資料已送出", "success");
        fetchData();
      })
      .catch(err => {
        console.error(err);
        Swal.fire("❌ 發送失敗", "請檢查網路或伺服器狀況", "error");
      });
    });
  };
}


//暫扣
async function handleOccupyFlow() {
  let occupyItems = [];
  let mode = "";

  const { value: selectedMode } = await Swal.fire({
    title: '請選擇操作類型',
    input: 'select',
    inputOptions: {
      use: '暫用（從倉庫扣除）',
      return: '歸還（補回倉庫）'
    },
    inputPlaceholder: '請選擇',
    showCancelButton: true
  });
  if (!selectedMode) return;
  mode = selectedMode;

  const categories = [...new Set(products.map(p => p.category || '未分類'))];
  const leftHtml = `
    <div style="width:60%; float:left; padding-right:3%; box-sizing:border-box; text-align:center">
      <select id="category" class="swal2-input" style="width:100%; margin-bottom:10px">
        <option value="">選擇分類</option>
        ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
      <div id="productArea" style="display:flex; flex-wrap:wrap; justify-content:center; gap:3px; margin-bottom:10px;"></div>
      <div id="styleArea" style="margin-bottom:10px"></div>
      <input type="number" id="qty" class="swal2-input" placeholder="輸入數量" min="1" style="max-width: 150px" />
      <button onclick="addOccupyItem()" class="swal2-confirm swal2-styled" style="margin-top:10px; width:100%">➕ 新增商品</button>
    </div>
  `;

  const rightHtml = `
    <div style="width:40%; float:right; padding-left:3%; box-sizing:border-box; border-left:1px solid #ccc; height:500px; overflow:auto; text-align:center">
      <h3>即時預覽</h3>
      <ul id="occupyPreviewList" style="padding-left:1em"></ul>
      <hr>
      <strong id="occupyPreviewTotal"></strong><br>
      <button onclick="finishOccupyItems()" class="swal2-confirm swal2-styled" style="margin-top:10px; width:100%">✅ 完成送出</button>
    </div>
  `;

  Swal.fire({
    title: `暫扣庫存 - ${mode === 'use' ? '佔用' : '歸還'}`,
    html: `<div style="display:flex; max-width:1000px">${leftHtml}${rightHtml}</div>`,
    showConfirmButton: false,
    width: '70%',
    willOpen: () => Swal.resetValidationMessage(),
    didOpen: () => setupOccupyForm()
  });

  window.addOccupyItem = function () {
    const qty = parseInt(document.getElementById('qty').value);
    const style = document.getElementById('style')?.value || '';
    const selected = JSON.parse(document.getElementById('styleArea').dataset.selected || '{}');
    if (!selected.name || !qty) {
      Swal.showValidationMessage('請選擇商品與數量');
      return;
    }
    occupyItems.push({
      name: selected.name,
      code: selected.code,
      category: selected.category,
      style,
      qty
    });
    updateOccupyPreview();
  };

  window.updateOccupyPreview = function () {
    const list = document.getElementById('occupyPreviewList');
    list.innerHTML = '';
    occupyItems.forEach((item, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `${item.name} ${item.style || ''} x${item.qty} <button onclick="removeOccupyItem(${idx})">❌</button>`;
      list.appendChild(li);
    });
    document.getElementById('occupyPreviewTotal').textContent = `共 ${occupyItems.length} 筆`;
  };

  window.removeOccupyItem = function (index) {
    occupyItems.splice(index, 1);
    updateOccupyPreview();
  };

  window.finishOccupyItems = function () {
    if (!occupyItems.length) return;
    if (mode === 'use') {
      askOccupyReason(occupyItems);
    } else {
      confirmOccupySubmit(occupyItems, "");
    }
  };

  function askOccupyReason(items) {
    Swal.fire({
      title: '輸入用途',
      input: 'text',
      inputPlaceholder: '例如：活動使用',
      showCancelButton: true,
      confirmButtonText: '預覽送出',
      cancelButtonText: '取消',
      customClass: { input: 'custom-input' }
    }).then(result => {
      if (!result.isConfirmed || !result.value) return;
      confirmOccupySubmit(items, result.value);
    });
  }

  function confirmOccupySubmit(items, reason) {
    let html = '<ul>';
    items.forEach(item => {
      html += `<li>${item.name} ${item.style || ''} x${item.qty}</li>`;
    });
    html += '</ul>';
    Swal.fire({
      title: '確認清單',
      html: html + (mode === "use" ? `<br>用途：${reason}` : ''),
      showCancelButton: true,
      confirmButtonText: '送出',
      cancelButtonText: '返回'
    }).then(res => {
      if (res.isConfirmed) {
        submitOccupy(items, reason);
      }
    });
  }

  function submitOccupy(items, reason) {
    const payload = {
      mode,
      reason,
      items,
      timestamp: new Date().toISOString()
    };
    fetch("/api/occupy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      Swal.fire("✅ 完成", data.message || "資料已送出", "success");
      fetchData();
    })
    .catch(err => {
      console.error(err);
      Swal.fire("❌ 發送失敗", "請確認網路或伺服器狀況", "error");
    });
  }

  function setupOccupyForm() {
    const categorySelect = document.getElementById('category');
    const productArea = document.getElementById('productArea');
    const styleArea = document.getElementById('styleArea');

    categorySelect.addEventListener('change', () => {
      const selectedCategory = categorySelect.value;
      const items = products.filter(p => p.category === selectedCategory);
      productArea.innerHTML = items.map(p => {
        const total = p.styles ? Object.values(p.styles).reduce((s, i) => s + i.warehouse, 0) : p.warehouse;
        const disabled = total === 0 ? 'disabled' : '';
        const label = total === 0 ? `${p.name}（無庫存）` : p.name;
        return `<button class="product-btn" data-name="${p.name}" ${disabled}>${label}</button>`;
      }).join('');

      setTimeout(() => {
        document.querySelectorAll('.product-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const itemName = btn.dataset.name;
            const selected = items.find(p => p.name === itemName);
            styleArea.innerHTML = '';
            if (selected.styles) {
              const options = sortSizes(selected.styles).map(size => {
                const stock = selected.styles[size];
                const total = stock.warehouse;
                const disabled = total === 0 ? 'disabled' : '';
                return `<option value="${size}" ${disabled}>${size}${total === 0 ? '（無庫存）' : ''}</option>`;
              }).join('');
              styleArea.innerHTML = `<select id="style" class="swal2-input">${options}</select>`;
            } else {
              styleArea.innerHTML = `<input type="hidden" id="style" value="">`;
            }
            styleArea.dataset.selected = JSON.stringify(selected);
          });
        });
      }, 0);
    });
  }
}



//月結
function openDownloadModal() {
  const html = `
    <label>開始日期：<input type="date" id="startDate" class="swal2-input"></label><br>
    <label>結束日期：<input type="date" id="endDate" class="swal2-input"></label>
  `;
  Swal.fire({
    title: '下載月結報表',
    html: html,
    confirmButtonText: '下載',
    showCancelButton: true,
    preConfirm: () => {
      const start = document.getElementById('startDate').value;
      const end = document.getElementById('endDate').value;
      if (!start || !end) {
        Swal.showValidationMessage("請選擇起訖日期");
        return false;
      }
      return { start, end };
    }
  }).then(result => {
    if (!result.isConfirmed) return;
    const { start, end } = result.value;
    fetch("/api/monthly-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_date: start, end_date: end })
    })
    .then(res => res.json())
    .then(data => {
      if (data.status === "success") {
        // 導向下載頁面
        window.location.href = `/download/${encodeURIComponent(data.file)}`;
      } else {
        Swal.fire("❌ 錯誤", data.message || "產生失敗", "error");
      }
    })
    .catch(err => {
      console.error(err);
      Swal.fire("❌ 發送失敗", "請檢查網路", "error");
    });
  });
}
