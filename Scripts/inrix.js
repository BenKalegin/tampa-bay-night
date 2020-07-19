var Inrix = /** @class */ (function () {
    function Inrix(container) {
        var _this = this;
        this.markerPool = [];
        this.markerColor = "#A0FF50";
        this.map = L.map(container).setView([28, -82.5], 12);
        L.tileLayer("http://{s}.sm.mapstack.stamen.com/(toner-lite,$fff[difference],$000[@6],$fff[hsl-saturation@70])/{z}/{x}/{y}.png")
            .addTo(this.map);
        // http://leafletjs.com/reference-1.0.0.html#path-option
        var pathAttributes = { color: '#000', stroke: false, fill: false };
        /*
                let loadedLayers = 0;
                this.map.on("layeradd", (e) => {
                    loadedLayers++;
                    if (loadedLayers == 2 * numPaths + 1) {
                        this.timerToken = setInterval(() => this.addSome(), 10);
                    }
        
                });
        */
        L.geoJSON(routes, { style: function () { return pathAttributes; } }).addTo(this.map);
        this.timerToken = setInterval(function () { return _this.addSome(); }, 20);
    }
    Inrix.prototype.mercatorXofLongitude = function (lon) {
        return lon * 20037508.34 / 180;
    };
    Inrix.prototype.mercatorYofLatitude = function (lat) {
        return (Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180)) * 20037508.34 / 180;
    };
    Inrix.prototype.updateNodes = function (quadtree) {
        var _this = this;
        var nodes = [];
        quadtree.depth = 0; // root
        quadtree.visit(function (node, x1, y1, x2, y2) {
            var nodeRect = {
                left: _this.mercatorXofLongitude(x1),
                right: _this.mercatorXofLongitude(x2),
                bottom: _this.mercatorYofLatitude(y1),
                top: _this.mercatorYofLatitude(y2)
            };
            node.width = (nodeRect.right - nodeRect.left);
            node.height = (nodeRect.top - nodeRect.bottom);
            if (node.depth == 0) {
                console.log(" width: " + node.width + "height: " + node.height);
            }
            nodes.push(node);
            for (var i = 0; i < 4; i++) {
                if (node.nodes[i])
                    node.nodes[i].depth = node.depth + 1;
            }
        });
        return nodes;
    };
    Inrix.prototype.getZoomScale = function () {
        var mapWidth = this.map.getSize().x;
        var bounds = this.map.getBounds();
        var planarWidth = this.mercatorXofLongitude(bounds.getEast()) - this.mercatorXofLongitude(bounds.getWest());
        var zoomScale = mapWidth / planarWidth;
        return zoomScale;
    };
    Inrix.prototype.pathStartPoint = function (path) {
        return path.getPointAtLength(0);
    };
    Inrix.prototype.recycle = function (marker) {
        this.markerPool.push(marker);
        marker.style("visibility", "hidden");
    };
    Inrix.prototype.makeFilter = function (defs) {
        this.glowFilter = defs.append("filter")
            .attr("id", "glow")
            .attr("x", "-5000%")
            .attr("y", "-5000%")
            .attr("width", "10000%")
            .attr("height", "10000%");
        this.glowFilter.append("feFlood")
            .attr("result", "flood")
            .attr("flood-color", this.markerColor)
            .attr("flood-opacity", "1");
        this.glowFilter.append("feComposite")
            .attr("in", "flood")
            .attr("result", "mask")
            .attr("in2", "SourceGraphic")
            .attr("operator", "in");
        this.glowFilter.append("feMorphology")
            .attr("in", "mask")
            .attr("result", "dilated")
            .attr("operator", "dilate")
            .attr("radius", "2");
        this.glowFilter.append("feGaussianBlur")
            .attr("in", "dilated")
            .attr("result", "blurred")
            .attr("stdDeviation", "3");
        var merge = this.glowFilter.append("feMerge");
        merge.append("feMergeNode")
            .attr("in", "blurred");
        merge.append("feMergeNode")
            .attr("in", "SourceGraphic");
    };
    Inrix.prototype.makeGradient = function (defs) {
        this.radialGradient = defs
            .append("radialGradient")
            .attr("id", "radial-gradient");
        this.radialGradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-opacity", "1")
            .attr("stop-color", this.markerColor);
        this.radialGradient.append("stop")
            .attr("stop-opacity", "0.9")
            .attr("offset", "15%")
            .attr("stop-color", this.markerColor);
        this.radialGradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-opacity", "0.1")
            .attr("stop-color", this.markerColor);
    };
    Inrix.prototype.allocateMarker = function (svg, startPoint) {
        var marker = this.markerPool.pop();
        if (marker == undefined) {
            if (this.radialGradient == undefined) {
                var defs = svg.append("defs");
                this.makeGradient(defs);
                this.makeFilter(defs);
            }
            marker = svg.append("ellipse");
            marker
                .attr("rx", 5)
                .attr("ry", 3)
                .attr("cx", 0)
                .attr("cy", 0)
                .style("fill", "url(#radial-gradient)")
                .style("filter", "url(#glow)");
        }
        marker
            .attr("transform", "translate(" + startPoint.x + "," + startPoint.y + ")")
            .style("visibility", "visible");
        return marker;
    };
    Inrix.prototype.createVehicleAndStartAnimation = function () {
        //clearInterval(this.timerToken);
        var _this = this;
        var svg = d3.select("svg");
        var paths = svg.selectAll("path")[0];
        var i = Math.floor(Math.random() * paths.length);
        var path = paths[i];
        var marker = this.allocateMarker(svg, this.pathStartPoint(path));
        var translateAlong = function (path) {
            var l = path.getTotalLength();
            return function (i) { return function (t) {
                var p = path.getPointAtLength(t * l);
                return "translate(" + p.x + "," + p.y + ")"; //Move marker
            }; };
        };
        var speed = 20 + 10 * Math.random();
        var transition = function (marker, path) {
            marker
                .transition()
                .ease("linear")
                .duration(path.getTotalLength() / speed * 200)
                .attrTween("transform", translateAlong(path))
                .each("end", function () { return _this.recycle(marker); });
        };
        transition(marker, path);
    };
    Inrix.prototype.addSome = function () {
        this.createVehicleAndStartAnimation();
    };
    return Inrix;
}());
//# sourceMappingURL=Inrix.js.map