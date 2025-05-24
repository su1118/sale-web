let products = [];
let saleItems = [];

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

function openModal(type) {
  if (type === '銷售') {
    handleSaleFlow();
  } else if (type === '退換貨') {
    saleItems = [];
    handleReturnFlow();
  } else {
    Swal.fire('功能尚未實作', `你點擊的是：${type}`, 'info');
  }
}

async function handleSaleFlow() {
  
  const categories = [...new Set(products.map(p => p.category || '未分類'))];

  const identityOptions = {
    校友: '校友',
    在校生: '在校生',
    師長: '師長',
    家長: '家長',
    其他: '其他'
  };
  const channelOptions = {
    店面: '店面',
    網路: '網路',
    校內活動: '校內活動'
  };

  const formHtml = `
    <select id="identity" class="swal2-input">
      <option value="">選擇身分別</option>
      ${Object.keys(identityOptions).map(k => `<option value="${k}">${k}</option>`).join('')}
    </select>
    <select id="channel" class="swal2-input">
      <option value="">選擇通路</option>
      ${Object.keys(channelOptions).map(k => `<option value="${k}">${k}</option>`).join('')}
    </select>
    <select id="category" class="swal2-input">
      <option value="">選擇大分類</option>
      ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
    </select>
    <div id="productArea"></div>
    <div id="styleArea" style="margin-top:10px;"></div>
    <input type="number" id="qty" class="swal2-input" placeholder="輸入數量" min="1" />
  `;

  await Swal.fire({
    title: '填寫銷售資訊',
    html: formHtml,
    didOpen: () => {
      const categorySelect = document.getElementById('category');
      const productArea = document.getElementById('productArea');
      const styleArea = document.getElementById('styleArea');

      categorySelect.addEventListener('change', () => {
        const selectedCategory = categorySelect.value;
        const items = products.filter(p => p.category === selectedCategory);
        productArea.innerHTML = items.map(p => {
          let total = 0;
          if (p.styles) {
            total = Object.values(p.styles).reduce((sum, s) => sum + s.center + s.warehouse, 0);
          } else {
            total = (p.center || 0) + (p.warehouse || 0);
          }
          const disabled = total === 0 ? 'disabled' : '';
          const label = total === 0 ? `${p.name}（無庫存）` : p.name;
          return `<button class="product-btn" data-name="${p.name}" ${disabled}>${label}</button>`;
        }).join(' ');

        // 商品選擇事件
        setTimeout(() => {
          document.querySelectorAll('.product-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              const itemName = btn.dataset.name;
              const selected = items.find(p => p.name === itemName);
              styleArea.innerHTML = '';

              if (selected.styles) {
                styleArea.innerHTML = `<label>選擇尺寸：<select id="style" class="swal2-input">` +
  sortSizes(selected.styles).map(size => {
    const stock = selected.styles[size];
    const total = stock.center + stock.warehouse;
    const disabled = total === 0 ? "disabled" : "";
    return `<option value="${size}" ${disabled}>${size}${total === 0 ? "（無庫存）" : ""}</option>`;
  }).join('') + `</select></label>`;
              } else {
                styleArea.innerHTML = `<input type="hidden" id="style" value="">`;
              }

              styleArea.dataset.selected = JSON.stringify(selected);

              // 樣式按鈕事件
              setTimeout(() => {
                document.querySelectorAll('.style-btn').forEach(styleBtn => {
                  styleBtn.addEventListener('click', () => {
                    document.getElementById('style')?.remove();
                    const hidden = document.createElement('input');
                    hidden.type = 'hidden';
                    hidden.id = 'style';
                    hidden.value = styleBtn.dataset.style;
                    styleArea.appendChild(hidden);
                  });
                });
              }, 0);
            });
          });
        }, 0);
      });
    },
    preConfirm: () => {
      const identity = document.getElementById('identity').value;
      const channel = document.getElementById('channel').value;
      const qty = parseInt(document.getElementById('qty').value);
      const style = document.getElementById('style')?.value || '';
      const selectedProduct = JSON.parse(document.getElementById('styleArea').dataset.selected || '{}');

      if (!identity || !channel || !selectedProduct.name || !qty) {
        Swal.showValidationMessage('請填寫所有欄位並選擇商品與數量');
        return false;
      }

      return {
        identity,
        channel,
        style,
        qty,
        product: selectedProduct
      };
    }
  }).then(async result => {
    if (!result.isConfirmed) return;
    const discountRate = ['校友', '在校生', '師長'].includes(result.value.identity) ? 0.9 : 1.0;
    const selected = result.value.product;
    saleItems.push({
  type: "return",
  
      name: selected.name,
      code: selected.code || '無代碼',
      category: selected.category,
      price: selected.price,
      style: result.value.style,
      qty: result.value.qty,
      subtotal: selected.price * result.value.qty * discountRate
    });

    
    const more = await Swal.fire({
      title: '已新增一筆商品',
      html: '是否還要新增其他商品？',
      showCancelButton: true,
      confirmButtonText: '➕ 繼續新增',
      cancelButtonText: '完成送出'
    });

    if (more.isConfirmed) {
      handleSaleFlow();  // 再次呼叫自己新增下一筆
    } else {
      showSaleSummary(saleItems, result.value.identity, result.value.channel, discountRate);
    }

  });
}

function showSaleSummary(items, identity, channel, discountRate) {
  let total = 0;
  let html = '<ul>';
  items.forEach(item => {
    total += item.subtotal;
    html += `<li>${item.name} ${item.style || ''} x ${item.qty} = $${item.subtotal.toFixed(0)}</li>`;
  });
  html += `</ul><hr><strong>總計：$${total.toFixed(0)}</strong>`;

  Swal.fire({
    title: '確認銷售項目',
    html: html,
    showCancelButton: true,
    confirmButtonText: '下一步',
    cancelButtonText: '返回修改'
  }).then(async result => {
    if (result.isConfirmed) {
      const { value: orderId } = await Swal.fire({
          title: '輸入單號',
          input: 'text',
          inputPlaceholder: '請輸入此筆銷售的單號',
          inputAttributes: {
            autocapitalize: 'off'
          },
          customClass: {
            input: 'custom-input'
          },
          showCancelButton: true,
          confirmButtonText: '送出',
          cancelButtonText: '取消'
        });
      if (!orderId) return;

      submitSaleToBackend(items, total, identity, channel, discountRate, orderId);
    } else {
    saleItems = [];  // ✅ 使用者選擇返回修改時，清空暫存
    }

  });
}

function submitSaleToBackend(items, total, identity, channel, discountRate, orderId) {
  const payload = {
    identity,
    channel,
    discount: discountRate,
    total,
    order_id: orderId,
    items,
    timestamp: new Date().toISOString()
  };

  fetch("/api/sale", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })
    .then(res => res.json())
    .then(data => {
      let resultText = data.result.map(r => `✅ ${r.code}${r.style ? ' [' + r.style + ']' : ''}：${r.status}`).join('<br>');
      Swal.fire('✅ 銷售完成', resultText, 'success');
      fetchData(); // ✅ 重新抓取最新商品資料
      saleItems = [];
    })
    .catch(err => {
      console.error(err);
      Swal.fire('❌ 發送失敗', '請檢查伺服器或網路狀況', 'error');
    });
}

//退換貨
async function handleReturnFlow() {
  const categories = [...new Set(products.map(p => p.category || '未分類'))];

  const formHtml = `
    <select id="mode" class="swal2-input">
      <option value="">退貨或換貨</option>
      <option value="return">退貨</option>
      <option value="exchange">換貨</option>
    </select>
    <select id="identity" class="swal2-input">
      <option value="">選擇身分別</option>
      <option value="校友">校友</option>
      <option value="在校生">在校生</option>
      <option value="師長">師長</option>
      <option value="家長">家長</option>
      <option value="其他">其他</option>
    </select>
    <select id="channel" class="swal2-input">
      <option value="">選擇通路</option>
      <option value="店面">店面</option>
      <option value="網路">網路</option>
      <option value="校內活動">校內活動</option>
    </select>
    <select id="category" class="swal2-input">
      <option value="">選擇分類</option>
      ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
    </select>
    <div id="productArea"></div>
    <div id="styleArea" style="margin-top:10px;"></div>
    <input type="number" id="qty" class="swal2-input" placeholder="輸入數量" min="1" />
  `;

  await Swal.fire({
    title: '填寫退換貨資料',
    html: formHtml,
    focusConfirm: false,
    didOpen: () => {
      const categorySelect = document.getElementById('category');
      const productArea = document.getElementById('productArea');
      const styleArea = document.getElementById('styleArea');

      categorySelect.addEventListener('change', () => {
        const selectedCategory = categorySelect.value;
        const items = products.filter(p => p.category === selectedCategory);
        productArea.innerHTML = items.map(p => {
          const label = p.name;
          return `<button class="product-btn" data-name="${p.name}">${label}</button>`;
        }).join('');

        setTimeout(() => {
          document.querySelectorAll('.product-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              const itemName = btn.dataset.name;
              const selected = products.find(p => p.name === itemName);
              styleArea.innerHTML = '';

              if (selected.styles) {
                styleArea.innerHTML = '<label>選擇尺寸：<select id="style" class="swal2-input">' +
                  sortSizes(selected.styles).map(size => {
                    return `<option value="${size}">${size}</option>`;
                  }).join('') + '</select></label>';
              } else {
                styleArea.innerHTML = `<input type="hidden" id="style" value="">`;
              }

              styleArea.dataset.selected = JSON.stringify(selected);
            });
          });
        }, 0);
      });
    },
    preConfirm: () => {
      const identity = document.getElementById('identity').value;
      const channel = document.getElementById('channel').value;
      const qty = parseInt(document.getElementById('qty').value);
      const style = document.getElementById('style')?.value || '';
      const selectedProduct = JSON.parse(document.getElementById('styleArea').dataset.selected || '{}');
      const mode = document.getElementById('mode').value;

      if (!mode || !identity || !channel || !selectedProduct.name || !qty) {
        Swal.showValidationMessage('請填寫所有欄位');
        return false;
      }

      return {
        mode,
        identity,
        channel,
        style,
        qty,
        product: selectedProduct
      };
    }
  }).then(async result => {
    if (!result.isConfirmed) return;

    const selected = result.value.product;
    saleItems.push({
      name: selected.name,
      code: selected.code,
      category: selected.category,
      price: selected.price,
      style: result.value.style,
      qty: result.value.qty,
      type: "return",
      subtotal: selected.price * result.value.qty
    });

    const more = await Swal.fire({
      title: '已加入商品',
      text: '是否繼續新增退換貨商品？',
      showCancelButton: true,
      confirmButtonText: '繼續',
      cancelButtonText: '完成'
    });

    if (more.isConfirmed) {
      handleReturnFlow();
    } else {
      if (result.value.mode === 'exchange') {
        handleExchangeFlow(saleItems, result.value.identity, result.value.channel);
      } else {
        showReturnSummary(saleItems, result.value.identity, result.value.channel);
      }
    }
  });
}

function showReturnSummary(items, identity, channel) {
  let total = 0;
  let html = '<ul>';
  items.forEach(item => {
    total += item.subtotal;
    html += `<li>${item.name} ${item.style || ''} x ${item.qty} = -$${item.subtotal}</li>`;
  });
  html += `</ul><hr><strong>應退金額：$${total}</strong>`;

  Swal.fire({
    title: '確認退貨清單',
    html: html,
    confirmButtonText: '下一步',
    showCancelButton: true,
    cancelButtonText: '返回修改'
  }).then(result => {
    if (result.isConfirmed) {
      askReturnOrderId(items, total, identity, channel);
    }
  });
}


function showExchangeSummary(oldItems, newItems, identity, channel) {
  let oldTotal = oldItems.reduce((sum, item) => sum + item.subtotal, 0);
  let newTotal = newItems.reduce((sum, item) => sum + item.subtotal, 0);
  let diff = newTotal - oldTotal;

  let html = `<h3>退貨商品：</h3><ul>`;
  oldItems.forEach(item => {
    html += `<li>${item.name} ${item.style || ''} x ${item.qty} = -$${item.subtotal}</li>`;
  });
  html += `</ul><h3>換貨商品：</h3><ul>`;
  newItems.forEach(item => {
    html += `<li>${item.name} ${item.style || ''} x ${item.qty} = +$${item.subtotal}</li>`;
  });
  html += `</ul><hr><strong>應補差額：$${diff}</strong>`;

  Swal.fire({
    title: '換貨差額確認',
    html: html,
    confirmButtonText: '下一步',
    showCancelButton: true,
    cancelButtonText: '返回修改'
  }).then(result => {
    if (result.isConfirmed) {
      askReturnOrderIdForExchange(oldItems, newItems, identity, channel);
    }
  });
}

function askReturnOrderIdForExchange(oldItems, newItems, identity, channel) {
  Swal.fire({
    title: '輸入單號',
    input: 'text',
    inputPlaceholder: '請輸入換貨單號',
    customClass: {
      input: 'custom-input'
    },
    showCancelButton: true,
    confirmButtonText: '送出',
    cancelButtonText: '取消'
  }).then(result => {
    if (!result.isConfirmed || !result.value) return;

    const orderId = result.value;
    const payload = {
      order_id: orderId,
      timestamp: new Date().toISOString(),
      identity,
      channel,
      items: [...oldItems, ...newItems]  // ✅ 合併兩邊的 items
    };

    fetch("/api/return", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        Swal.fire("✅ 換貨完成", data.message || "已提交資料", "success");
        fetchData();
        saleItems = [];
      })
      .catch(err => {
        console.error(err);
        Swal.fire("❌ 發送失敗", "請檢查伺服器或網路", "error");
      });
  });
}



function askReturnOrderId(items) {
  Swal.fire({
    title: '輸入單號',
    input: 'text',
    inputPlaceholder: '請輸入退換貨單號',
    showCancelButton: true,
    confirmButtonText: '送出',
    cancelButtonText: '取消',
    customClass: { input: 'custom-input' }
  }).then(result => {
    if (!result.isConfirmed || !result.value) return;
    const orderId = result.value;
    submitReturnToBackend(items, orderId);
  });
}

function submitReturnToBackend(items, orderId) {
  const payload = {
    order_id: orderId,
    timestamp: new Date().toISOString(),
    items: items
  };

  fetch("/api/return", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    Swal.fire('✅ 完成', data.message || '退換貨已提交', 'success');
    fetchData();
    saleItems = [];
  })
  .catch(err => {
    console.error(err);
    Swal.fire('❌ 發送失敗', '請檢查網路或伺服器狀況', 'error');
  });
}

async function handleExchangeFlow(oldItems, identity, channel) {
  const categories = [...new Set(products.map(p => p.category || '未分類'))];

  const formHtml = `
    <select id="category" class="swal2-input">
      <option value="">選擇分類</option>
      ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
    </select>
    <div id="productArea"></div>
    <div id="styleArea" style="margin-top:10px;"></div>
    <input type="number" id="qty" class="swal2-input" placeholder="輸入數量" min="1" />
  `;

  await Swal.fire({
    title: '新增換貨商品',
    html: formHtml,
    focusConfirm: false,
    didOpen: () => {
      const categorySelect = document.getElementById('category');
      const productArea = document.getElementById('productArea');
      const styleArea = document.getElementById('styleArea');

      categorySelect.addEventListener('change', () => {
        const selectedCategory = categorySelect.value;
        const items = products.filter(p => p.category === selectedCategory);
        productArea.innerHTML = items.map(p => {
          let total = 0;
          if (p.styles) {
            total = Object.values(p.styles).reduce((sum, s) => sum + s.center + s.warehouse, 0);
          } else {
            total = (p.center || 0) + (p.warehouse || 0);
          }
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
                styleArea.innerHTML = '<label>選擇尺寸：<select id="style" class="swal2-input">' +
                 sortSizes(selected.styles).map(size => {
                  const stock = selected.styles[size];
                  const total = stock.center + stock.warehouse;
                  const disabled = total === 0 ? "disabled" : "";
                  return `<option value="${size}" ${disabled}>${size}${total === 0 ? "（無庫存）" : ""}</option>`;
                }).join('') + '</select></label>';
              } else {
                styleArea.innerHTML = `<input type="hidden" id="style" value="">`;
              }

              styleArea.dataset.selected = JSON.stringify(selected);
            });
          });
        }, 0);
      });
    },
    preConfirm: () => {
      const qty = parseInt(document.getElementById('qty').value);
      const style = document.getElementById('style')?.value || '';
      const selectedProduct = JSON.parse(document.getElementById('styleArea').dataset.selected || '{}');

      if (!selectedProduct.name || !qty) {
        Swal.showValidationMessage('請選擇商品與數量');
        return false;
      }

      return {
        qty,
        style,
        product: selectedProduct
      };
    }
  }).then(async result => {
    if (!result.isConfirmed) return;

    const selected = result.value.product;
    const newItem = {
      name: selected.name,
      code: selected.code,
      category: selected.category,
      price: selected.price,
      style: result.value.style,
      qty: result.value.qty,
      type: "exchange_out",
      subtotal: selected.price * result.value.qty
    };

    const more = await Swal.fire({
      title: '已新增一筆換貨商品',
      html: '是否繼續新增其他換貨商品？',
      showCancelButton: true,
      confirmButtonText: '繼續新增',
      cancelButtonText: '完成送出'
    });

    if (more.isConfirmed) {
      handleExchangeFlow(oldItems, identity, channel);
    } else {
      showExchangeSummary(oldItems, [newItem], identity, channel);
    }
  });
}

//贈與/工用
async function handleGiftFlow() {
  let giftItems = [];

  async function addGiftItem() {
    const categories = [...new Set(products.map(p => p.category || '未分類'))];

    const formHtml = `
      <select id="category" class="swal2-input">
        <option value="">選擇分類</option>
        ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
      <div id="productArea"></div>
      <div id="styleArea" style="margin-top:10px;"></div>
      <input type="number" id="qty" class="swal2-input" placeholder="輸入數量" min="1" />
    `;

    await Swal.fire({
      title: '贈與/工用',
      html: formHtml,
      focusConfirm: false,
      didOpen: () => {
        const categorySelect = document.getElementById('category');
        const productArea = document.getElementById('productArea');
        const styleArea = document.getElementById('styleArea');

        categorySelect.addEventListener('change', () => {
          const selectedCategory = categorySelect.value;
          const items = products.filter(p => p.category === selectedCategory);
          productArea.innerHTML = items.map(p => {
            const total = p.styles
              ? Object.values(p.styles).reduce((sum, s) => sum + s.center + s.warehouse, 0)
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
                  const styleOptions = sortSizes(selected.styles).map(size => {
                    const stock = selected.styles[size];
                    const total = stock.center + stock.warehouse;
                    const disabled = total === 0 ? "disabled" : "";
                    return `<option value="${size}" ${disabled}>${size}${total === 0 ? "（無庫存）" : ""}</option>`;
                  }).join('');
                  styleArea.innerHTML = `<select id="style" class="swal2-input">${styleOptions}</select>`;
                } else {
                  styleArea.innerHTML = `<input type="hidden" id="style" value="">`;
                }

                styleArea.dataset.selected = JSON.stringify(selected);
              });
            });
          }, 0);
        });
      },
      preConfirm: () => {
        const qty = parseInt(document.getElementById('qty').value);
        const style = document.getElementById('style')?.value || '';
        const selected = JSON.parse(document.getElementById('styleArea').dataset.selected || '{}');
        if (!selected.name || !qty) {
          Swal.showValidationMessage('請選擇商品與數量');
          return false;
        }
        return {
          product: selected,
          style,
          qty
        };
      }
    }).then(result => {
      if (!result.isConfirmed) return;
      const p = result.value.product;
      giftItems.push({
        name: p.name,
        code: p.code,
        category: p.category,
        price: 0,
        style: result.value.style,
        qty: result.value.qty
      });

      Swal.fire({
        title: '✅ 已新增一筆',
        text: '是否繼續新增？',
        showCancelButton: true,
        confirmButtonText: '新增',
        cancelButtonText: '完成'
      }).then(r => {
        if (r.isConfirmed) {
          addGiftItem();
        } else {
          askGiftReason(giftItems);
        }
      });
    });
  }

  function askGiftReason(items) {
    Swal.fire({
      title: '輸入用途/贈與人',
      input: 'text',
      inputPlaceholder: '例如：展覽樣品 / 教材 / 陳老師',
      showCancelButton: true,
      customClass: {
            input: 'custom-input'
          },
      confirmButtonText: '預覽送出',
      cancelButtonText: '取消'
    }).then(result => {
      if (!result.isConfirmed || !result.value) return;

      const reason = result.value;
      let html = '<ul>';
      items.forEach(item => {
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
          submitGiftToBackend(items, reason);
        }
      });
    });
  }

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

  // 啟動第一筆新增
  addGiftItem();
}


//調貨
async function handleTransferFlow() {
  let transferItems = [];

  async function addTransferItem() {
    const categories = [...new Set(products.map(p => p.category || '未分類'))];

    const formHtml = `
      <select id="category" class="swal2-input">
        <option value="">選擇分類</option>
        ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
      <div id="productArea"></div>
      <div id="styleArea" style="margin-top:10px;"></div>
      <input type="number" id="qty" class="swal2-input" placeholder="輸入數量" min="1" />
    `;

    await Swal.fire({
      title: '新增調貨商品',
      html: formHtml,
      focusConfirm: false,
      didOpen: () => {
        const categorySelect = document.getElementById('category');
        const productArea = document.getElementById('productArea');
        const styleArea = document.getElementById('styleArea');

        categorySelect.addEventListener('change', () => {
          const selectedCategory = categorySelect.value;
          const items = products.filter(p => p.category === selectedCategory);
          productArea.innerHTML = items.map(p => {
            const total = p.styles
              ? Object.values(p.styles).reduce((sum, s) => sum + s.warehouse, 0)
              : (p.warehouse || 0);
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
                  const styleOptions = sortSizes(selected.styles).map(size => {
                    const stock = selected.styles[size];
                    const total = stock.center + stock.warehouse;
                    const disabled = total === 0 ? "disabled" : "";
                    return `<option value="${size}" ${disabled}>${size}${total === 0 ? "（無庫存）" : ""}</option>`;
                  }).join('');
                  styleArea.innerHTML = `<select id="style" class="swal2-input">${styleOptions}</select>`;
                } else {
                  styleArea.innerHTML = `<input type="hidden" id="style" value="">`;
                }

                styleArea.dataset.selected = JSON.stringify(selected);
              });
            });
          }, 0);
        });
      },
      preConfirm: () => {
        const qty = parseInt(document.getElementById('qty').value);
        const style = document.getElementById('style')?.value || '';
        const selected = JSON.parse(document.getElementById('styleArea').dataset.selected || '{}');
        if (!selected.name || !qty) {
          Swal.showValidationMessage('請選擇商品與數量');
          return false;
        }
        return {
          product: selected,
          style,
          qty
        };
      }
    }).then(result => {
      if (!result.isConfirmed) return;
      const p = result.value.product;
      transferItems.push({
        name: p.name,
        code: p.code,
        category: p.category,
        style: result.value.style,
        qty: result.value.qty
      });

      Swal.fire({
        title: '✅ 已新增一筆調貨',
        text: '是否繼續新增？',
        showCancelButton: true,
        confirmButtonText: '新增',
        cancelButtonText: '完成'
      }).then(r => {
        if (r.isConfirmed) {
          addTransferItem();
        } else {
          showTransferSummary(transferItems);
        }
      });
    });
  }

  function showTransferSummary(items) {
    let html = '<ul>';
    items.forEach(item => {
      html += `<li>${item.name} ${item.style || ''} x${item.qty}</li>`;
    });
    html += '</ul>';

    Swal.fire({
      title: '確認調貨清單',
      html: html,
      showCancelButton: true,
      confirmButtonText: '送出',
      cancelButtonText: '返回'
    }).then(res => {
      if (res.isConfirmed) {
        submitTransfer(items);
      }
    });
  }

  function submitTransfer(items) {
    const payload = {
      timestamp: new Date().toISOString(),
      items: items
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

  // 啟動新增
  addTransferItem();
}


//補貨
async function handleRestockFlow() {
  let restockItems = [];

  async function addRestockItem() {
    const categories = [...new Set(products.map(p => p.category || '未分類'))];

    const formHtml = `
      <select id="category" class="swal2-input">
        <option value="">選擇分類</option>
        ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
      <div id="productArea"></div>
      <div id="styleArea" style="margin-top:10px;"></div>
      <input type="number" id="qty" class="swal2-input" placeholder="補貨數量" min="1" />
    `;

    await Swal.fire({
      title: '新增補貨商品',
      html: formHtml,
      focusConfirm: false,
      didOpen: () => {
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
                const selected = products.find(p => p.name === itemName);
                styleArea.innerHTML = '';

                if (selected.styles) {
                 const styleOptions = sortSizes(selected.styles).map(size => {
                  return `<option value="${size}">${size}</option>`;
                }).join('');
                  styleArea.innerHTML = `<select id="style" class="swal2-input">${styleOptions}</select>`;
                } else {
                  styleArea.innerHTML = `<input type="hidden" id="style" value="">`;
                }

                styleArea.dataset.selected = JSON.stringify(selected);
              });
            });
          }, 0);
        });
      },
      preConfirm: () => {
        const qty = parseInt(document.getElementById('qty').value);
        const style = document.getElementById('style')?.value || '';
        const selected = JSON.parse(document.getElementById('styleArea').dataset.selected || '{}');
        if (!selected.name || !qty) {
          Swal.showValidationMessage('請選擇商品與數量');
          return false;
        }
        return {
          product: selected,
          style,
          qty
        };
      }
    }).then(result => {
      if (!result.isConfirmed) return;
      const p = result.value.product;
      restockItems.push({
        name: p.name,
        code: p.code,
        category: p.category,
        style: result.value.style,
        qty: result.value.qty
      });

      Swal.fire({
        title: '✅ 已新增一筆補貨',
        text: '是否繼續新增？',
        showCancelButton: true,
        confirmButtonText: '新增',
        cancelButtonText: '完成'
      }).then(r => {
        if (r.isConfirmed) {
          addRestockItem();
        } else {
          showRestockSummary(restockItems);
        }
      });
    });
  }

  function showRestockSummary(items) {
    let html = '<ul>';
    items.forEach(item => {
      html += `<li>${item.name} ${item.style || ''} x${item.qty}</li>`;
    });
    html += '</ul>';

    Swal.fire({
      title: '確認補貨清單',
      html: html,
      showCancelButton: true,
      confirmButtonText: '送出',
      cancelButtonText: '返回'
    }).then(res => {
      if (res.isConfirmed) {
        submitRestock(items);
      }
    });
  }

  function submitRestock(items) {
    const payload = {
      timestamp: new Date().toISOString(),
      items: items
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

  // 啟動第一筆新增
  addRestockItem();
}


//活動
async function handleActivityFlow() {
  let activityItems = [];
  const response = await fetch('/api/activity-products');
  const activityProducts = await response.json();

  const products = Object.values(activityProducts);
  const categories = [...new Set(products.map(p => p.category || '未分類'))];

  const { value: identity } = await Swal.fire({
    title: '選擇身分別',
    input: 'select',
    inputOptions: {
      校友: '校友',
      在校生: '在校生',
      師長: '師長',
      家長: '家長',
      其他: '其他'
    },
    inputPlaceholder: '請選擇身分別',
    showCancelButton: true
  });
  if (!identity) return;

  async function addItem() {
    const formHtml = `
      <select id="category" class="swal2-input">
        <option value="">選擇分類</option>
        ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
      <div id="productArea"></div>
      <div id="styleArea" style="margin-top:10px;"></div>
      <input type="number" id="qty" class="swal2-input" placeholder="輸入數量" min="1" />
    `;

    await Swal.fire({
      title: '新增活動商品',
      html: formHtml,
      focusConfirm: false,
      didOpen: () => {
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
                styleArea.innerHTML = '';

                const styleOptions = sortSizes(selected.styles).map(size => {
                  const stock = selected.styles[size];
                  const total = stock.center + stock.warehouse;
                  const disabled = total === 0 ? "disabled" : "";
                  return `<option value="${size}" ${disabled}>${size}${total === 0 ? "（無庫存）" : ""}</option>`;
                }).join('');
                styleArea.innerHTML = `<select id="style" class="swal2-input">${styleOptions}</select>`;
                styleArea.dataset.selected = JSON.stringify(selected);
              });
            });
          }, 0);
        });
      },
      preConfirm: () => {
        const qty = parseInt(document.getElementById('qty').value);
        const style = document.getElementById('style')?.value || '';
        const selected = JSON.parse(document.getElementById('styleArea').dataset.selected || '{}');
        if (!selected.name || !qty) {
          Swal.showValidationMessage('請選擇商品與數量');
          return false;
        }
        return {
          product: selected,
          style,
          qty
        };
      }
    }).then(async result => {
      if (!result.isConfirmed) return;
      const p = result.value.product;
      activityItems.push({
        name: p.name,
        code: p.code,
        category: p.category,
        price: p.price,
        style: result.value.style,
        qty: result.value.qty,
        subtotal: p.price * result.value.qty
      });

      const more = await Swal.fire({
        title: '✅ 已新增一筆',
        text: '是否繼續新增？',
        showCancelButton: true,
        confirmButtonText: '繼續新增',
        cancelButtonText: '完成'
      });

      if (more.isConfirmed) {
        addItem();
      } else {
        showActivitySummary(activityItems, identity);
      }
    });
  }

  function showActivitySummary(items, identity) {
    let total = 0;
    let html = '<ul>';
    items.forEach(item => {
      total += item.subtotal;
      html += `<li>${item.name} ${item.style || ''} x${item.qty} = $${item.subtotal}</li>`;
    });
    html += `</ul><hr><strong>總金額：$${total}</strong>`;

    Swal.fire({
      title: '確認送出活動訂單',
      html: html,
      confirmButtonText: '下一步',
      showCancelButton: true
    }).then(async result => {
      if (result.isConfirmed) {
        askActivityOrderId(items, identity, total);
      }
    });
  }

  function askActivityOrderId(items, identity, total) {
  Swal.fire({
    title: '輸入單號',
    input: 'text',
    inputPlaceholder: '請輸入活動單號',
    showCancelButton: true,
    confirmButtonText: '送出',
    cancelButtonText: '取消',
    customClass: {
      input: 'custom-input'
    }
  }).then(result => {
    if (!result.isConfirmed || !result.value) return;
    const orderId = result.value;

    const payload = {
      order_id: orderId,
      identity,
      timestamp: new Date().toISOString(),
      items: items.map(item => ({
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
      headers: {
        "Content-Type": "application/json"
      },
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
}
  addItem(); // 啟動第一筆新增
}


//佔扣
async function handleOccupyFlow() {
  let occupyItems = [];
  let mode = "";

  const { value: selectedMode } = await Swal.fire({
    title: '請選擇操作類型',
    input: 'select',
    inputOptions: {
      use: '佔用（從倉庫扣除）',
      return: '歸還（補回倉庫）'
    },
    inputPlaceholder: '請選擇',
    showCancelButton: true
  });
  if (!selectedMode) return;
  mode = selectedMode;

  async function addItem() {
    const categories = [...new Set(products.map(p => p.category || '未分類'))];

    const formHtml = `
      <select id="category" class="swal2-input">
        <option value="">選擇分類</option>
        ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
      <div id="productArea"></div>
      <div id="styleArea" style="margin-top:10px;"></div>
      <input type="number" id="qty" class="swal2-input" placeholder="輸入數量" min="1" />
    `;

    await Swal.fire({
      title: `新增${mode === "use" ? "佔用" : "歸還"}商品`,
      html: formHtml,
      focusConfirm: false,
      didOpen: () => {
        const categorySelect = document.getElementById('category');
        const productArea = document.getElementById('productArea');
        const styleArea = document.getElementById('styleArea');

        categorySelect.addEventListener('change', () => {
          const selectedCategory = categorySelect.value;
          const items = products.filter(p => p.category === selectedCategory);
          productArea.innerHTML = items.map(p => {
            const total = p.styles
              ? Object.values(p.styles).reduce((sum, s) => sum + s.warehouse, 0)
              : (p.warehouse || 0);
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
                  const styleOptions = sortSizes(selected.styles).map(size => {
                    const stock = selected.styles[size];
                    const total = stock.center + stock.warehouse;
                    const disabled = total === 0 ? "disabled" : "";
                    return `<option value="${size}" ${disabled}>${size}${total === 0 ? "（無庫存）" : ""}</option>`;
                  }).join('');
                  styleArea.innerHTML = `<select id="style" class="swal2-input">${styleOptions}</select>`;
                } else {
                  styleArea.innerHTML = `<input type="hidden" id="style" value="">`;
                }

                styleArea.dataset.selected = JSON.stringify(selected);
              });
            });
          }, 0);
        });
      },
      preConfirm: () => {
        const qty = parseInt(document.getElementById('qty').value);
        const style = document.getElementById('style')?.value || '';
        const selected = JSON.parse(document.getElementById('styleArea').dataset.selected || '{}');
        if (!selected.name || !qty) {
          Swal.showValidationMessage('請選擇商品與數量');
          return false;
        }
        return {
          product: selected,
          style,
          qty
        };
      }
    }).then(async result => {
      if (!result.isConfirmed) return;
      const p = result.value.product;
      occupyItems.push({
        name: p.name,
        code: p.code,
        category: p.category,
        style: result.value.style,
        qty: result.value.qty
      });

      const more = await Swal.fire({
        title: '✅ 已新增一筆',
        text: '是否繼續新增？',
        showCancelButton: true,
        confirmButtonText: '繼續新增',
        cancelButtonText: '完成'
      });

      if (more.isConfirmed) {
        addItem();
      } else {
        if (mode === "use") {
          askOccupyReason(occupyItems);
        } else {
          confirmOccupySubmit(occupyItems, "");
        }
      }
    });
  }

  function askOccupyReason(items) {
    Swal.fire({
      title: '輸入用途',
      input: 'text',
      inputPlaceholder: '例如：活動使用',
      showCancelButton: true,
      customClass: {
            input: 'custom-input'
          },
      confirmButtonText: '預覽送出',
      cancelButtonText: '取消'
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

  // 開始第一筆
  addItem();
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
