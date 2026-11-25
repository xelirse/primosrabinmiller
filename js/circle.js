// Draw circular graph with directional arrows and outer callout bubbles
function drawCircularGraph(ctx, rootNode) {
	// Collect unique nodes and directed edges from the tree
	var nodesMap = new Map();

	function traverse(node) {
		var key = node.textStr.replace('~', '');
		if (!nodesMap.has(key)) {
			nodesMap.set(key, {
				key: key,
				textStr: node.textStr,
				type: node.type,
				children: new Set()
			});
		}
		var mapped = nodesMap.get(key);
		for (var i = 0; i < node.children.length; i++) {
			var child = node.children[i];
			var childKey = child.textStr.replace('~', '');
			mapped.children.add(childKey);
			traverse(child);
		}
	}
	traverse(rootNode);

	// Sort unique values numerically from largest to smallest
	var nodes = Array.from(nodesMap.values()).sort(function (a, b) {
		var ba = BigInt(a.key);
		var bb = BigInt(b.key);
		return bb > ba ? 1 : (bb < ba ? -1 : 0);
	});

	var totalNodes = nodes.length;
	if (totalNodes === 0) return;

	// Compute radial layout around center (0, 0)
	var nodeRadius = 35;
	var hasCallouts = nodes.some(function (n) {
		return n.key.length > 9;
	});
	var baseRadius = Math.max(300, (totalNodes * (nodeRadius * 2 + 30)) / (2 * Math.PI));
	var calloutRadius = baseRadius + (hasCallouts ? 120 : 20);

	var angleStep = (2 * Math.PI) / totalNodes;
	var startAngle = -Math.PI / 2;

	var tempCtx = document.createElement('canvas').getContext('2d');
	tempCtx.font = '12px monospace';

	nodes.forEach(function (node, i) {
		var angle = startAngle + i * angleStep;
		node.x = baseRadius * Math.cos(angle);
		node.y = baseRadius * Math.sin(angle);

		if (node.key.length > 9) {
			node.calloutX = calloutRadius * Math.cos(angle);
			node.calloutY = calloutRadius * Math.sin(angle);
			node.boxWidth = tempCtx.measureText(node.key).width + 24;
			node.boxHeight = 28;
		}
	});

	// Separate overlapping outer callout boxes vertically
	var callouts = nodes.filter(function (n) {
		return n.calloutX !== undefined;
	});

	for (var iter = 0; iter < 50; iter++) {
		var moved = false;
		for (var i = 0; i < callouts.length; i++) {
			for (var j = i + 1; j < callouts.length; j++) {
				var a = callouts[i];
				var b = callouts[j];
				var minDx = (a.boxWidth + b.boxWidth) / 2 + 10;
				var minDy = (a.boxHeight + b.boxHeight) / 2 + 6;

				var dx = Math.abs(a.calloutX - b.calloutX);
				var dy = Math.abs(a.calloutY - b.calloutY);

				if (dx < minDx && dy < minDy) {
					var push = (minDy - dy) / 2 + 1;
					if (a.calloutY < b.calloutY) {
						a.calloutY -= push;
						b.calloutY += push;
					} else {
						a.calloutY += push;
						b.calloutY -= push;
					}
					moved = true;
				}
			}
		}
		if (!moved) break;
	}

	// Compute bounding box including nodes and callouts
	var minX = -nodeRadius;
	var maxX = nodeRadius;
	var minY = -nodeRadius;
	var maxY = nodeRadius;

	nodes.forEach(function (node) {
		minX = Math.min(minX, node.x - nodeRadius);
		maxX = Math.max(maxX, node.x + nodeRadius);
		minY = Math.min(minY, node.y - nodeRadius);
		maxY = Math.max(maxY, node.y + nodeRadius);

		if (node.calloutX !== undefined) {
			minX = Math.min(minX, node.calloutX - node.boxWidth / 2);
			maxX = Math.max(maxX, node.calloutX + node.boxWidth / 2);
			minY = Math.min(minY, node.calloutY - node.boxHeight / 2);
			maxY = Math.max(maxY, node.calloutY + node.boxHeight / 2);
		}
	});

	var padding = 60;
	var canvasWidth = Math.ceil(maxX - minX + padding * 2);
	var canvasHeight = Math.ceil(maxY - minY + padding * 2);

	var canvas = document.getElementById('treeCanvas');
	canvas.width = canvasWidth;
	canvas.height = canvasHeight;

	var offsetX = -minX + padding;
	var offsetY = -minY + padding;

	nodes.forEach(function (n) {
		n.x += offsetX;
		n.y += offsetY;
		if (n.calloutX !== undefined) {
			n.calloutX += offsetX;
			n.calloutY += offsetY;
		}
	});

	// Draw directed edges between nodes
	ctx.lineWidth = 1.5;
	nodes.forEach(function (node) {
		node.children.forEach(function (childKey) {
			var to = nodesMap.get(childKey);
			if (!to) return;

			var dx = to.x - node.x;
			var dy = to.y - node.y;
			var dist = Math.sqrt(dx * dx + dy * dy);
			if (dist === 0) return;

			var ux = dx / dist;
			var uy = dy / dist;

			var startX = node.x + ux * nodeRadius;
			var startY = node.y + uy * nodeRadius;
			var endX = to.x - ux * (nodeRadius + 10);
			var endY = to.y - uy * (nodeRadius + 10);

			ctx.beginPath();
			ctx.strokeStyle = getEdgeColor(node.type);
			ctx.moveTo(startX, startY);
			ctx.lineTo(endX, endY);
			ctx.stroke();

			var arrowSize = 8;
			var arrowAngle = Math.atan2(dy, dx);
			ctx.beginPath();
			ctx.fillStyle = getEdgeColor(node.type);
			ctx.moveTo(endX, endY);
			ctx.lineTo(
				endX - arrowSize * Math.cos(arrowAngle - Math.PI / 6),
				endY - arrowSize * Math.sin(arrowAngle - Math.PI / 6)
			);
			ctx.lineTo(
				endX - arrowSize * Math.cos(arrowAngle + Math.PI / 6),
				endY - arrowSize * Math.sin(arrowAngle + Math.PI / 6)
			);
			ctx.closePath();
			ctx.fill();
		});
	});

	// Draw outer callout bubbles
	nodes.forEach(function (node) {
		if (node.calloutX !== undefined) {
			drawCallout(ctx, node, nodeRadius);
		}
	});

	// Draw main circular nodes
	nodes.forEach(function (node) {
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

		ctx.beginPath();
		ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI);
		ctx.fillStyle = bgColor;
		ctx.fill();
		ctx.lineWidth = 2;
		ctx.strokeStyle = borderColor;
		ctx.stroke();

		ctx.fillStyle = '#e0e7f0';
		ctx.font = '10px monospace';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		var displayText = node.textStr;
		if (displayText.length > 9) {
			displayText = displayText.substring(0, 4) + '..' + displayText.slice(-3);
		}
		ctx.fillText(displayText, node.x, node.y);
	});
}

// Draw outer callout bubble and pointer arrow for long values
function drawCallout(ctx, node, nodeRadius) {
	var dx = node.x - node.calloutX;
	var dy = node.y - node.calloutY;
	var dist = Math.sqrt(dx * dx + dy * dy);
	if (dist === 0) return;
	var ux = dx / dist;
	var uy = dy / dist;

	var startX = node.calloutX;
	var startY = node.calloutY;
	var endX = node.x - ux * (nodeRadius + 5);
	var endY = node.y - uy * (nodeRadius + 5);

	ctx.beginPath();
	ctx.strokeStyle = 'rgba(148, 163, 184, 0.8)';
	ctx.lineWidth = 1.5;
	ctx.moveTo(startX, startY);
	ctx.lineTo(endX, endY);
	ctx.stroke();

	var arrowSize = 8;
	var angle = Math.atan2(dy, dx);
	ctx.beginPath();
	ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
	ctx.moveTo(endX, endY);
	ctx.lineTo(
		endX - arrowSize * Math.cos(angle - Math.PI / 6),
		endY - arrowSize * Math.sin(angle - Math.PI / 6)
	);
	ctx.lineTo(
		endX - arrowSize * Math.cos(angle + Math.PI / 6),
		endY - arrowSize * Math.sin(angle + Math.PI / 6)
	);
	ctx.closePath();
	ctx.fill();

	ctx.beginPath();
	ctx.roundRect(node.calloutX - node.boxWidth / 2, node.calloutY - node.boxHeight / 2, node.boxWidth, node.boxHeight, 6);
	ctx.fillStyle = '#111827';
	ctx.fill();
	ctx.strokeStyle = '#4b5563';
	ctx.lineWidth = 1.5;
	ctx.stroke();

	ctx.fillStyle = '#f3f4f6';
	ctx.font = '12px monospace';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(node.key, node.calloutX, node.calloutY);
}
