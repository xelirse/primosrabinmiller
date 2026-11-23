// ============================================================
// DIBUJO DEL ÁRBOL (Canvas)
// ============================================================
function getTreeLayoutConfig() {
	if (!getTreeLayoutConfig._v) {
		getTreeLayoutConfig._v = {
			H_GAP: 48,
			V_GAP: 42
		};
	}
	return getTreeLayoutConfig._v;
}

// Toggle tree container visibility and render the genealogy tree on canvas
async function toggleTree() {
	var container = document.getElementById('treeContainer');
	var canvas = document.getElementById('treeCanvas');
	var treeBtn = document.getElementById('treeToggleBtn');
	var st = estado();

	if (!container || !canvas || !treeBtn) return;

	if (container.style.display === 'block') {
		container.style.display = 'none';
		treeBtn.textContent = '🌳 Ver Árbol';
		return;
	}

	if (!st.lastResult) {
		notificar('No hay resultados para mostrar.', 'warn');
		return;
	}

	var prime = st.lastResult.prime;
	var index = st.lastResult.index;
	var exact = st.lastResult.exact;

	var session = st.lastSessionId ? loadSessions().find(function (s) {
		return s.id === st.lastSessionId;
	}) : null;

	if (!session) {
		var sessions = loadSessions();
		session = sessions.find(function (s) {
			return s.status === 'completed' &&
				(s.latestPrimeFound === prime.toString() || s.primeIndex === index.toString());
		});
		if (session) {
			st.lastSessionId = session.id;
		}
	}

	var root;
	if (session && session.treeData) {
		root = session.treeData;
	} else {
		treeBtn.disabled = true;
		treeBtn.textContent = '⏳ Generando...';
		setButtonsEnabled(false, false);
		updateStatus('running', '● Generando árbol...');

		var preFrag = document.createDocumentFragment();
		var preSpan = document.createElement('span');
		preSpan.textContent = 'Preparando árbol genealógico...';
		preFrag.appendChild(preSpan);
		updateProgress(null, preFrag);

		await new Promise(function (resolve) {
			setTimeout(resolve, 50);
		});

		try {
			root = await buildTree(index, 'Index', 0, !exact);
			if (session) {
				session.treeData = root;
				upsertSession(session);
			}
		} catch (err) {
			console.error(err);
			notificar('Error al generar el árbol: ' + err.message, 'error');

			var errFrag = document.createDocumentFragment();
			var errSpan = document.createElement('span');
			errSpan.textContent = 'Error al generar el árbol.';
			errFrag.appendChild(errSpan);
			updateProgress(0, errFrag);

			updateStatus('idle', '● En espera');
			treeBtn.disabled = false;
			treeBtn.textContent = '🌳 Ver Árbol';
			setButtonsEnabled(true, false);
			return;
		}
	}

	try {
		var primeNode = {
			type: 'Prime',
			approx: !exact,
			children: [root],
			depth: 0,
			textStr: (!exact ? '~' : '') + prime.toString()
		};

		st.lastTreeRoot = primeNode;

		var dims = computeLayout(primeNode);

		canvas.width = dims.totalWidth;
		canvas.height = dims.totalHeight;

		var ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		container.style.display = 'block';
		resetTreeZoom();

		var doneFrag = document.createDocumentFragment();
		var doneSpan = document.createElement('span');
		doneSpan.textContent = '✅ Árbol generado y guardado con éxito.';
		doneFrag.appendChild(doneSpan);
		updateProgress(100, doneFrag);

		updateStatus('completed', '✔ Completado');
	} catch (err) {
		console.error(err);
		notificar('Error al dibujar el árbol.', 'error');
	} finally {
		treeBtn.disabled = false;
		treeBtn.textContent = '🌳 Ver Árbol';
		setButtonsEnabled(true, false);
	}
}

async function buildTree(val, type, depth, isApprox) {
	if (isApprox === undefined) isApprox = false;
	var node = {
		type: type,
		approx: isApprox,
		children: [],
		depth: depth,
		textStr: (isApprox ? '~' : '') + val.toString()
	};

	if (depth > 15) {
		node.type = 'End';
		return node;
	}

	if (type === 'Prime') {
		var frag = document.createDocumentFragment();
		var b = document.createElement('b');
		b.textContent = '🌳 Nivel ' + (depth + 1) + ': Obteniendo índice del primo';
		frag.appendChild(b);
		frag.appendChild(document.createElement('br'));

		var span2 = document.createElement('span');
		span2.style.wordBreak = 'break-all';
		span2.style.fontSize = '0.8rem';
		span2.style.color = '#60a5fa';
		span2.textContent = val.toString();
		frag.appendChild(span2);
		frag.appendChild(document.createElement('br'));

		var i = document.createElement('i');
		i.textContent = 'Contando primos (Criba o Riemann R)...';
		frag.appendChild(i);

		updateProgress(null, frag);
		await new Promise(function (resolve) {
			setTimeout(resolve, 10);
		});

		var resPrime = await getPrimeIndexAsync(val);
		if (resPrime.val > 0n) {
			node.children.push(await buildTree(resPrime.val, 'Index', depth + 1, resPrime.approx));
		}
	} else if (type === 'Index') {
		if (val === 1n) {
			node.type = 'End';
			node.textStr = '1';
		} else if (millerRabin(val, 5)) {
			node.type = 'PrimeIndex';

			var fragP = document.createDocumentFragment();
			var bP = document.createElement('b');
			bP.textContent = '🌳 Nivel ' + (depth + 1) + ': El índice es Primo';
			fragP.appendChild(bP);
			fragP.appendChild(document.createElement('br'));

			var spanP = document.createElement('span');
			spanP.style.wordBreak = 'break-all';
			spanP.style.fontSize = '0.8rem';
			spanP.style.color = '#a78bfa';
			spanP.textContent = val.toString();
			fragP.appendChild(spanP);
			fragP.appendChild(document.createElement('br'));

			var iP = document.createElement('i');
			iP.textContent = 'Calculando su propio índice...';
			fragP.appendChild(iP);

			updateProgress(null, fragP);
			await new Promise(function (resolve) {
				setTimeout(resolve, 10);
			});

			var resIdx = await getPrimeIndexAsync(val);
			if (resIdx.val > 0n) {
				node.children.push(await buildTree(resIdx.val, 'Index', depth + 1, resIdx.approx));
			}
		} else {
			var fragC = document.createDocumentFragment();
			var bC = document.createElement('b');
			bC.textContent = '🌳 Nivel ' + (depth + 1) + ': Factorizando índice compuesto';
			fragC.appendChild(bC);
			fragC.appendChild(document.createElement('br'));

			var spanC = document.createElement('span');
			spanC.style.wordBreak = 'break-all';
			spanC.style.fontSize = '0.8rem';
			spanC.style.color = '#fbbf24';
			spanC.textContent = val.toString();
			fragC.appendChild(spanC);
			fragC.appendChild(document.createElement('br'));

			var iC = document.createElement('i');
			iC.textContent = 'Iniciando factorización...';
			fragC.appendChild(iC);

			updateProgress(null, fragC);
			await new Promise(function (resolve) {
				setTimeout(resolve, 50);
			});

			var factors = await factorize(val, [], function (status, currentFactors, currentN) {
				var eqFrag = document.createDocumentFragment();

				var bEq = document.createElement('b');
				bEq.textContent = '🌳 Nivel ' + (depth + 1) + ': Factorizando índice compuesto';
				eqFrag.appendChild(bEq);
				eqFrag.appendChild(document.createElement('br'));

				var eqSpan = document.createElement('span');
				eqSpan.style.wordBreak = 'break-all';
				eqSpan.style.fontSize = '0.8rem';
				eqSpan.style.color = '#e0e7f0';

				eqSpan.appendChild(document.createTextNode(val.toString() + ' = '));

				var hasSomething = false;
				if (currentFactors && currentFactors.length > 0) {
					hasSomething = true;
					var counts = {};
					currentFactors.forEach(function (f) {
						var s = f.toString();
						counts[s] = (counts[s] || 0) + 1;
					});

					var keys = Object.keys(counts);
					keys.forEach(function (k, idx) {
						eqSpan.appendChild(document.createTextNode(k));
						if (counts[k] > 1) {
							var sup = document.createElement('sup');
							sup.textContent = counts[k];
							eqSpan.appendChild(sup);
						}
						if (idx < keys.length - 1) {
							eqSpan.appendChild(document.createTextNode(' × '));
						}
					});
				}

				if (currentN && currentN > 1n) {
					if (hasSomething) {
						eqSpan.appendChild(document.createTextNode(' × '));
					}
					var nSpan = document.createElement('span');
					nSpan.style.color = '#f97316';
					nSpan.style.fontWeight = 'bold';
					nSpan.textContent = currentN.toString();
					eqSpan.appendChild(nSpan);
				} else if (!hasSomething) {
					eqSpan.appendChild(document.createTextNode('...'));
				}

				eqFrag.appendChild(eqSpan);
				eqFrag.appendChild(document.createElement('br'));
				eqFrag.appendChild(document.createElement('br'));

				var iStatus = document.createElement('i');
				iStatus.textContent = status;
				eqFrag.appendChild(iStatus);

				updateProgress(null, eqFrag);
			});

			var uniqueFactors = Array.from(new Set(factors.map(function (f) {
				return f.toString();
			}))).map(function (f) {
				return BigInt(f);
			});

			for (var idxFactor = 0; idxFactor < uniqueFactors.length; idxFactor++) {
				node.children.push(await buildTree(uniqueFactors[idxFactor], 'Prime', depth + 1, false));
			}
		}
	}
	return node;
}

// Draw horizontal segment while hopping over vertical segments
function drawHoppingHorizontal(ctx, x1, x2, y, verticalSegments, hopRadius) {
	if (Math.abs(x2 - x1) < 0.5) return;
	var dir = x2 > x1 ? 1 : -1;
	var start = x1;
	var end = x2;
	var minX = Math.min(x1, x2);
	var maxX = Math.max(x1, x2);

	var blockers = [];
	for (var i = 0; i < verticalSegments.length; i++) {
		var seg = verticalSegments[i];
		var vx = (typeof seg.drawX === 'number') ? seg.drawX : seg.x;
		var crossesY = seg.yTop < y - 0.5 && seg.yBottom > y + 0.5;
		var insideX = vx >= minX - 0.5 && vx <= maxX + 0.5;
		if (crossesY && insideX) {
			blockers.push(vx);
		}
	}

	blockers.sort(function (a, b) {
		return dir > 0 ? a - b : b - a;
	});

	var curX = start;
	ctx.moveTo(curX, y);

	for (var j = 0; j < blockers.length; j++) {
		var bx = blockers[j];
		var preX = bx - dir * hopRadius;
		var postX = bx + dir * hopRadius;
		if (dir > 0) {
			if (preX <= curX) continue;
			if (preX >= end) {
				ctx.lineTo(end - hopRadius * 2, y);
				ctx.lineTo(end - hopRadius, y - hopRadius);
				ctx.lineTo(end, y);
				return;
			}
		} else {
			if (preX >= curX) continue;
			if (preX <= end) {
				ctx.lineTo(end + hopRadius * 2, y);
				ctx.lineTo(end + hopRadius, y - hopRadius);
				ctx.lineTo(end, y);
				return;
			}
		}
		ctx.lineTo(preX, y);
		ctx.lineTo(bx, y - hopRadius);
		ctx.lineTo(postX, y);
		curX = postX;
	}

	ctx.lineTo(end, y);
}

// Return edge color matching the parent bubble type
function getEdgeColor(type) {
	if (type === 'Prime') return 'rgba(96, 165, 250, 0.96)';
	if (type === 'Index') return 'rgba(251, 191, 36, 0.96)';
	if (type === 'PrimeIndex') return 'rgba(167, 139, 250, 0.96)';
	return 'rgba(148, 163, 184, 0.96)';
}

// Collect unique numeric values across the tree
function collectTreeValues(node, valuesSet) {
	valuesSet.add(node.textStr.replace('~', ''));
	for (var i = 0; i < node.children.length; i++) {
		collectTreeValues(node.children[i], valuesSet);
	}
}

// Collect horizontal bounds per row for a subtree
function collectSubtreeRowBounds(node, boundsByRow) {
	var rowKey = node.y;
	var cur = boundsByRow.get(rowKey);
	var left = node.x;
	var right = node.x + node.nodeWidth;
	if (!cur) {
		boundsByRow.set(rowKey, { minX: left, maxX: right });
	} else {
		if (left < cur.minX) cur.minX = left;
		if (right > cur.maxX) cur.maxX = right;
	}
	for (var i = 0; i < node.children.length; i++) {
		collectSubtreeRowBounds(node.children[i], boundsByRow);
	}
}

// Assign row coordinates by shared numeric value so equal numbers align horizontally
function collectTreeNodes(node, rankOf, nodeHeight, vGap, margin, allNodes, byLevel) {
	var rowIndex = rankOf.get(node.textStr.replace('~', ''));
	node.nodeWidth = Math.max(76, node.textStr.length * 7 + 16);
	node.nodeHeight = nodeHeight;
	node.y = margin + rowIndex * (nodeHeight + vGap);
	allNodes.push(node);
	if (!byLevel[rowIndex]) byLevel[rowIndex] = [];
	byLevel[rowIndex].push(node);
	for (var i = 0; i < node.children.length; i++) {
		collectTreeNodes(node.children[i], rankOf, nodeHeight, vGap, margin, allNodes, byLevel);
	}
}

// Flag any bubble that still overlaps another bubble after layout
function markOverlappingBubbles(allNodes) {
	for (var i = 0; i < allNodes.length; i++) {
		allNodes[i].colliding = false;
	}
	for (var aIdx = 0; aIdx < allNodes.length; aIdx++) {
		for (var bIdx = aIdx + 1; bIdx < allNodes.length; bIdx++) {
			var nodeA = allNodes[aIdx];
			var nodeB = allNodes[bIdx];
			if (areBubblesOverlapping(nodeA, nodeB, 0)) {
				nodeA.colliding = true;
				nodeB.colliding = true;
			}
		}
	}
}

// Measure compact subtree width bottom-up
function measureTreeSubtree(node, hGap) {
	if (!node.children || node.children.length === 0) {
		node.subtreeWidth = node.nodeWidth;
		return node.subtreeWidth;
	}
	var childrenSum = 0;
	for (var i = 0; i < node.children.length; i++) {
		childrenSum += measureTreeSubtree(node.children[i], hGap);
		if (i > 0) childrenSum += hGap;
	}
	node.subtreeWidth = Math.max(node.nodeWidth, childrenSum);
	return node.subtreeWidth;
}

// Offset overlapping vertical segments that share the same X and Y range
function separateCollinearVerticals(verticalSegments) {
	var laneOffset = 4;
	for (var i = 0; i < verticalSegments.length; i++) {
		var a = verticalSegments[i];
		for (var j = i + 1; j < verticalSegments.length; j++) {
			var b = verticalSegments[j];
			var sameX = Math.abs(a.x - b.x) < 1;
			var overlapY = Math.min(a.yBottom, b.yBottom) - Math.max(a.yTop, b.yTop) > 1;
			if (sameX && overlapY) {
				if (!a.drawX) a.drawX = a.x - laneOffset;
				if (!b.drawX) b.drawX = b.x + laneOffset;
			}
		}
	}
	for (var k = 0; k < verticalSegments.length; k++) {
		if (!verticalSegments[k].drawX) {
			verticalSegments[k].drawX = verticalSegments[k].x;
		}
	}
}

// Ensure parent and children do not share the same horizontal row
function separateParentChildRows(node, rankOf) {
	var pKey = node.textStr.replace('~', '');
	var pRank = rankOf.get(pKey);
	for (var i = 0; i < node.children.length; i++) {
		var child = node.children[i];
		var cKey = child.textStr.replace('~', '');
		var cRank = rankOf.get(cKey);
		if (cRank <= pRank) {
			var nextRank = pRank + 1;
			rankOf.set(cKey, nextRank);
		}
		separateParentChildRows(child, rankOf);
	}
}

// Shift a node and its descendants horizontally together
function shiftTreeSubtree(node, dx) {
	if (Math.abs(dx) < 0.001) return;
	node.x += dx;
	for (var i = 0; i < node.children.length; i++) {
		shiftTreeSubtree(node.children[i], dx);
	}
}

// Position parent and pack children compactly beneath it
function layoutTreeNode(node, centerX, hGap) {
	node.x = centerX - node.nodeWidth / 2;

	var k = node.children.length;
	if (k === 0) return;

	if (k === 1) {
		layoutTreeNode(node.children[0], centerX, hGap);
		node.children[0].x = node.x + node.nodeWidth / 2 - node.children[0].nodeWidth / 2;
		return;
	}

	var totalCompactWidth = 0;
	for (var i = 0; i < k; i++) {
		totalCompactWidth += node.children[i].subtreeWidth;
		if (i > 0) totalCompactWidth += hGap;
	}

	var cursorLeft = centerX - totalCompactWidth / 2;
	for (var j = 0; j < k; j++) {
		var child = node.children[j];
		var childCenter = cursorLeft + child.subtreeWidth / 2;
		layoutTreeNode(child, childCenter, hGap);
		cursorLeft += child.subtreeWidth + hGap;
	}

	// Pack adjacent child subtrees as tightly as row occupancy allows
	for (var idx = 1; idx < k; idx++) {
		var prevChild = node.children[idx - 1];
		var curChild = node.children[idx];
		var shiftNeeded = computeCompactSubtreeShift(prevChild, curChild, hGap);
		if (Math.abs(shiftNeeded) > 0.001) {
			shiftTreeSubtree(curChild, shiftNeeded);
		}
	}

	// Center parent over its children span
	var minChildLeft = Infinity;
	var maxChildRight = -Infinity;
	for (var cIdx = 0; cIdx < k; cIdx++) {
		var cNode = node.children[cIdx];
		if (cNode.x < minChildLeft) minChildLeft = cNode.x;
		if (cNode.x + cNode.nodeWidth > maxChildRight) maxChildRight = cNode.x + cNode.nodeWidth;
	}
	var actualCenter = (minChildLeft + maxChildRight) / 2;
	node.x = actualCenter - node.nodeWidth / 2;
}

// Resolve 2D collisions across all nodes so bubbles do not share the same spot
function resolveAllBubbleCollisions(allNodes, hGap) {
	for (var pass = 0; pass < 25; pass++) {
		var anyMoved = false;
		for (var i = 0; i < allNodes.length; i++) {
			for (var j = i + 1; j < allNodes.length; j++) {
				var a = allNodes[i];
				var b = allNodes[j];
				if (areBubblesOverlapping(a, b, hGap)) {
					var target = b.x >= a.x ? b : a;
					var anchor = target === b ? a : b;
					var neededX = anchor.x + anchor.nodeWidth + hGap;
					if (neededX > target.x) {
						shiftTreeSubtree(target, neededX - target.x);
						anyMoved = true;
					}
				}
			}
		}
		if (!anyMoved) break;
	}
}

// Resolve horizontal overlaps per row so no two nodes ever collide
function resolveRowCollisions(byLevel, hGap) {
	for (var pass = 0; pass < 8; pass++) {
		var moved = false;
		for (var r = 0; r < byLevel.length; r++) {
			var level = byLevel[r];
			if (!level || level.length < 2) continue;
			level.sort(function (a, b) {
				return a.x - b.x;
			});
			for (var i = 1; i < level.length; i++) {
				var prevRight = level[i - 1].x + level[i - 1].nodeWidth;
				var minX = prevRight + hGap;
				if (level[i].x < minX) {
					shiftTreeSubtree(level[i], minX - level[i].x);
					moved = true;
				}
			}
		}
		if (!moved) break;
	}
}

// Compute minimum horizontal shift so rightSubtree does not share X range with leftSubtree
function computeCompactSubtreeShift(leftSubtree, rightSubtree, hGap) {
	var leftBounds = new Map();
	var rightBounds = new Map();
	collectSubtreeRowBounds(leftSubtree, leftBounds);
	collectSubtreeRowBounds(rightSubtree, rightBounds);

	var leftMaxX = -Infinity;
	leftBounds.forEach(function (box) {
		if (box.maxX > leftMaxX) leftMaxX = box.maxX;
	});

	var rightMinX = Infinity;
	rightBounds.forEach(function (box) {
		if (box.minX < rightMinX) rightMinX = box.minX;
	});

	if (leftMaxX === -Infinity || rightMinX === Infinity) {
		return (leftSubtree.x + leftSubtree.nodeWidth + hGap) - rightSubtree.x;
	}

	return (leftMaxX + hGap) - rightMinX;
}

// Compute full node layout and canvas dimensions
function computeLayout(root) {
	var cfg = getTreeLayoutConfig();
	var hGap = Math.max(14, Math.min(28, cfg.H_GAP));
	var vGap = cfg.V_GAP;
	var nodeHeight = 34;
	var margin = 8;

	var valuesSet = new Set();
	collectTreeValues(root, valuesSet);

	var sorted = Array.from(valuesSet).sort(function (a, b) {
		var valA = BigInt(a);
		var valB = BigInt(b);
		return valA > valB ? -1 : valA < valB ? 1 : 0;
	});

	var rankOf = new Map();
	sorted.forEach(function (v, i) {
		rankOf.set(v, i);
	});

	separateParentChildRows(root, rankOf);

	// Compact ranks so there are no empty row gaps
	var usedRanks = Array.from(new Set(Array.from(rankOf.values()))).sort(function (a, b) {
		return a - b;
	});
	var compactMap = new Map();
	usedRanks.forEach(function (r, idx) {
		compactMap.set(r, idx);
	});
	rankOf.forEach(function (r, k) {
		rankOf.set(k, compactMap.get(r));
	});

	var allNodes = [];
	var byLevel = [];
	collectTreeNodes(root, rankOf, nodeHeight, vGap, margin, allNodes, byLevel);

	measureTreeSubtree(root, hGap);
	layoutTreeNode(root, margin + root.subtreeWidth / 2, hGap);
	resolveRowCollisions(byLevel, hGap);
	resolveAllBubbleCollisions(allNodes, hGap);
	resolveRowCollisions(byLevel, hGap);
	markOverlappingBubbles(allNodes);

	var minLeft = Infinity;
	var maxRight = -Infinity;
	for (var idx = 0; idx < allNodes.length; idx++) {
		var n = allNodes[idx];
		if (n.x < minLeft) minLeft = n.x;
		if (n.x + n.nodeWidth > maxRight) maxRight = n.x + n.nodeWidth;
	}

	var shiftX = margin - minLeft;
	for (var j = 0; j < allNodes.length; j++) {
		allNodes[j].x += shiftX;
	}

	var maxRow = Math.max(0, byLevel.length - 1);
	var totalWidth = (maxRight + shiftX) + margin;
	var totalHeight = margin * 2 + maxRow * (nodeHeight + vGap) + nodeHeight;
	return { totalWidth: totalWidth, totalHeight: totalHeight };
}

// Group parent nodes by row Y to stagger horizontal buses cleanly
function gatherTreeEdges(node, edgesByRow) {
	if (!node.children || node.children.length === 0) return;
	var rowKey = node.y;
	if (!edgesByRow.has(rowKey)) edgesByRow.set(rowKey, []);
	edgesByRow.get(rowKey).push(node);
	for (var i = 0; i < node.children.length; i++) {
		gatherTreeEdges(node.children[i], edgesByRow);
	}
}

// Collect all vertical connector segments across the entire tree
function collectAllVerticalSegments(busPlan, verticalSegments) {
	for (var i = 0; i < busPlan.length; i++) {
		var item = busPlan[i];
		verticalSegments.push({ x: item.startX, yTop: item.bottomY, yBottom: item.busY });
		for (var j = 0; j < item.parent.children.length; j++) {
			var child = item.parent.children[j];
			var cx = child.x + child.nodeWidth / 2;
			verticalSegments.push({ x: cx, yTop: item.busY, yBottom: child.y });
		}
	}
}

// Draw all tree bubbles above connectors
function drawTreeNodes(ctx, node) {
	var bgColor = '#2a3a55';
	var borderColor = '#94a3b8';
	if (node.type === 'Prime') {
		bgColor = '#1e3a5f';
		borderColor = '#60a5fa';
	} else if (node.type === 'Index') {
		bgColor = '#4a3a20';
		borderColor = '#fbbf24';
	} else if (node.type === 'PrimeIndex') {
		bgColor = '#3b2066';
		borderColor = '#a78bfa';
	}

	if (node.colliding) {
		bgColor = '#991b1b';
		borderColor = '#f87171';
	}

	var z = getTreeZoomState();
	var scale = z && z.scale ? z.scale : 1;
	var minBorderWidth = getMinScreenLineWidth(scale, 1);
	var baseBorderWidth = 1.5 / Math.max(0.35, scale);

	ctx.fillStyle = bgColor;
	ctx.strokeStyle = borderColor;
	ctx.lineWidth = Math.max(minBorderWidth, Math.min(6, baseBorderWidth));

	ctx.beginPath();
	ctx.roundRect(node.x, node.y, node.nodeWidth, node.nodeHeight, 5);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#e0e7f0';
	ctx.font = '11px monospace';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(node.textStr, node.x + node.nodeWidth / 2, node.y + node.nodeHeight / 2 - 5);

	ctx.font = '9px sans-serif';
	ctx.fillStyle = node.colliding ? '#fecaca' : '#8899b0';
	var typeStr = 'Fin';
	if (node.type === 'Prime') typeStr = 'Primo';
	else if (node.type === 'Index') typeStr = 'Índice';
	else if (node.type === 'PrimeIndex') typeStr = 'Índice primo';

	if (node.approx) typeStr += ' (aprox)';
	ctx.fillText(typeStr, node.x + node.nodeWidth / 2, node.y + node.nodeHeight / 2 + 6);

	for (var i = 0; i < node.children.length; i++) {
		drawTreeNodes(ctx, node.children[i]);
	}
}

// Draw full tree edges and nodes on canvas
function drawTree(ctx, root) {
	var z = getTreeZoomState();
	var scale = z && z.scale ? z.scale : 1;
	var minEdgeWidth = getMinScreenLineWidth(scale, 1);
	var baseEdgeWidth = 1.8 / Math.max(0.35, scale);
	ctx.lineWidth = Math.max(minEdgeWidth, Math.min(8, baseEdgeWidth));

	var edgesByRow = new Map();
	var busPlan = [];
	var verticalSegments = [];

	gatherTreeEdges(root, edgesByRow);

	edgesByRow.forEach(function (parentsInRow) {
		var withSpans = parentsInRow.map(function (parent) {
			var startX = parent.x + parent.nodeWidth / 2;
			var bottomY = parent.y + parent.nodeHeight;
			var minX = startX;
			var maxX = startX;
			var minChildTop = Infinity;
			for (var i = 0; i < parent.children.length; i++) {
				var c = parent.children[i];
				var cx = c.x + c.nodeWidth / 2;
				if (cx < minX) minX = cx;
				if (cx > maxX) maxX = cx;
				if (c.y < minChildTop) minChildTop = c.y;
			}
			return { parent: parent, startX: startX, bottomY: bottomY, minX: minX, maxX: maxX, minChildTop: minChildTop };
		});

		var slotCount = Math.max(1, withSpans.length);
		for (var idx = 0; idx < withSpans.length; idx++) {
			var item = withSpans[idx];
			var topBound = item.bottomY + 6;
			var botBound = Math.max(topBound + 4, item.minChildTop - 6);
			var ratio = slotCount === 1 ? 0.5 : (idx + 0.5) / slotCount;
			var busY = topBound + (botBound - topBound) * ratio;

			var dropSeg = { x: item.startX, yTop: item.bottomY, yBottom: busY, drawX: item.startX };
			verticalSegments.push(dropSeg);

			var childSegs = [];
			for (var j = 0; j < item.parent.children.length; j++) {
				var child = item.parent.children[j];
				var cx = child.x + child.nodeWidth / 2;
				var cSeg = { x: cx, yTop: busY, yBottom: child.y, drawX: cx };
				verticalSegments.push(cSeg);
				childSegs.push({ child: child, cx: cx, seg: cSeg });
			}

			busPlan.push({
				parent: item.parent,
				startX: item.startX,
				bottomY: item.bottomY,
				minX: item.minX,
				maxX: item.maxX,
				busY: busY,
				dropSeg: dropSeg,
				childSegs: childSegs
			});
		}
	});

	separateCollinearVerticals(verticalSegments);

	var hopRadius = 5;
	for (var bIdx = 0; bIdx < busPlan.length; bIdx++) {
		var planItem = busPlan[bIdx];
		var dropX = planItem.dropSeg.drawX;
		ctx.strokeStyle = getEdgeColor(planItem.parent.type);

		ctx.beginPath();
		ctx.moveTo(planItem.startX, planItem.bottomY);
		ctx.lineTo(dropX, planItem.busY);
		if (planItem.maxX > planItem.minX) {
			drawHoppingHorizontal(ctx, planItem.minX, planItem.maxX, planItem.busY, verticalSegments, hopRadius);
		}
		ctx.stroke();

		for (var cIdx = 0; cIdx < planItem.childSegs.length; cIdx++) {
			var cInfo = planItem.childSegs[cIdx];
			var legX = cInfo.seg.drawX;
			ctx.beginPath();
			ctx.moveTo(legX, planItem.busY);
			ctx.lineTo(legX, cInfo.child.y);
			ctx.stroke();
		}
	}

	drawTreeNodes(ctx, root);
}

// Redraw active tree when zoom scale changes
function redrawTreeForZoom() {
	var st = estado();
	var canvas = document.getElementById('treeCanvas');
	if (!canvas || !st.lastTreeRoot) return;
	var ctx = canvas.getContext('2d');
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	drawTree(ctx, st.lastTreeRoot);
}

// Return current zoom state object stored on estado()
function getTreeZoomState() {
	var st = estado();
	if (!st.treeZoom) {
		st.treeZoom = {
			scale: 1,
			panX: 0,
			panY: 0,
			dragging: false,
			lastX: 0,
			lastY: 0
		};
	}
	return st.treeZoom;
}

// Apply current zoom scale and pan offset to the canvas
function applyTreeTransform() {
	var canvas = document.getElementById('treeCanvas');
	var label = document.getElementById('treeZoomLabel');
	var z = getTreeZoomState();
	if (canvas) {
		canvas.style.transform = 'translate(' + z.panX + 'px, ' + z.panY + 'px) scale(' + z.scale + ')';
	}
	if (label) {
		label.textContent = Math.round(z.scale * 100) + '%';
	}
	redrawTreeForZoom();
}

// Check whether two bubble boxes overlap including horizontal margin
function areBubblesOverlapping(a, b, hGap) {
	var padX = (typeof hGap === 'number' ? hGap : 12) * 0.5;
	var aLeft = a.x - padX;
	var aRight = a.x + a.nodeWidth + padX;
	var bLeft = b.x - padX;
	var bRight = b.x + b.nodeWidth + padX;

	var aTop = a.y;
	var aBottom = a.y + a.nodeHeight;
	var bTop = b.y;
	var bBottom = b.y + b.nodeHeight;

	var overlapX = aLeft < bRight && aRight > bLeft;
	var overlapY = aTop < bBottom && aBottom > bTop;
	return overlapX && overlapY;
}

// Adjust zoom level by a multiplier factor around an optional viewport point
function zoomTree(factor, clientX, clientY) {
	var z = getTreeZoomState();
	var viewport = document.getElementById('treeViewport');
	var oldScale = z.scale;
	var nextScale = Math.min(4, Math.max(0.02, oldScale * factor));
	if (Math.abs(nextScale - oldScale) < 0.00001) return;

	var rect = viewport ? viewport.getBoundingClientRect() : null;
	var anchorX = (rect && typeof clientX === 'number') ? (clientX - rect.left) : (rect ? rect.width / 2 : 0);
	var anchorY = (rect && typeof clientY === 'number') ? (clientY - rect.top) : (rect ? rect.height / 2 : 0);

	var worldX = (anchorX - z.panX) / oldScale;
	var worldY = (anchorY - z.panY) / oldScale;

	z.scale = nextScale;
	z.panX = anchorX - worldX * nextScale;
	z.panY = anchorY - worldY * nextScale;

	applyTreeTransform();
}

// Reset zoom level and pan position to fit from top-left
function resetTreeZoom() {
	var z = getTreeZoomState();
	z.scale = 1;
	z.panX = 0;
	z.panY = 0;
	applyTreeTransform();
}

// Zoom in or out using mouse wheel
function handleTreeWheel(event) {
	event.preventDefault();
	var factor = event.deltaY < 0 ? 1.15 : 0.85;
	zoomTree(factor, event.clientX, event.clientY);
}

// Start dragging the canvas inside the viewport
function startTreePan(event) {
	var z = getTreeZoomState();
	z.dragging = true;
	z.lastX = event.clientX;
	z.lastY = event.clientY;
}

// Update pan offset while dragging
function moveTreePan(event) {
	var z = getTreeZoomState();
	if (!z.dragging) return;
	var dx = event.clientX - z.lastX;
	var dy = event.clientY - z.lastY;
	z.lastX = event.clientX;
	z.lastY = event.clientY;
	z.panX += dx;
	z.panY += dy;
	applyTreeTransform();
}

// Stop dragging the canvas
function endTreePan() {
	var z = getTreeZoomState();
	z.dragging = false;
}

// Return canvas lineWidth that renders at least minScreenPx in screen pixels
function getMinScreenLineWidth(scale, minScreenPx) {
	var safeScale = (scale && scale > 0) ? scale : 1;
	var minPx = (typeof minScreenPx === 'number' && minScreenPx > 0) ? minScreenPx : 1;
	return minPx / safeScale;
}
