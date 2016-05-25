/*
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
*/
opletColor = {"quarks.streamscope.oplets.StreamScope": "#c7c7c7",
        "quarks.metrics.oplets.CounterOp": "#c7c7c7", "quarks.metrics.oplets.RateMeter": "#aec7e8", "quarks.oplet.core.FanIn": "#ff7f0e",
		"quarks.oplet.core.FanOut": "#ffbb78", "quarks.oplet.core.Peek": "#2ca02c", "quarks.oplet.core.PeriodicSource": "#98df8a", 
		"quarks.oplet.core.Pipe": "#d62728", "quarks.oplet.core.PipeWindow": "#ff9896", "quarks.oplet.core.ProcessSource": "#9467bd", 
		"quarks.oplet.core.Sink": "#c5b0d5", "quarks.oplet.core.Source": "#8c564b", "quarks.oplet.core.Split": "#c49c94", "quarks.oplet.core.Union" : "#1f77b4",
		"quarks.oplet.functional.ConsumerEventSource": "#e377c2", "quarks.oplet.functional.ConsumerPeek": "#f7b6d2", "quarks.oplet.functional.ConsumerSink": "#7f7f7f", 
		"quarks.oplet.functional.Filter": "#7F7F7F", "quarks.oplet.functional.FlatMapper": "#bcbd22", "quarks.oplet.functional.Isolate": "#dbdb8d", 
		"quarks.oplet.functional.Map": "#17becf", "quarks.oplet.functional.SupplierPeriodicSource": "#9edae5", "quarks.oplet.functional.SupplierSource": "#b5cf6b", 
		"quarks.oplet.plumbing.PressureReliever": "#e7cb94", "quarks.oplet.plumbing.TextFileReader": "#ad494a", "quarks.oplet.plumbing.UnorderedIsolate": "#de9ed6"};
colorMap = {};

addValuesToEdges = function(graph, counterMetrics) {
	var edges = graph.edges;
	var vertices = graph.vertices;
	var max = d3.max(counterMetrics, function(cm){
		return parseInt(cm.value, 10);
	});
	var quartile1 = parseInt(max * 0.25, 10);
	
	if (!graph.edgeMap) {
	    // fwiw, at this time, graph is new object on every call so these
	    // are rebuilt every time.  ugh.
        graph.edgeMap = makeEdgeMap(edges);  // edgeKey(edge) -> edge; {incoming,outgoing}EdgesKey(opId) -> edges[]
	    graph.vertexMap = makeVertexMap(vertices);  // id -> vertex
	    graph.equivMetricEdgeMap = makeEquivMetricEdgeMap(graph, counterMetrics); // metricEdge -> equivEdges[]
	}

	// assign the counter metric value to the edge that has the oplet id as a source or target
	// and set value in equivalent edges
	counterMetrics.forEach(function(cm){
	    var edges = graph.edgeMap[incomingEdgesKey(cm.opId)];
	    pushArray(edges, graph.edgeMap[outgoingEdgesKey(cm.opId)]);
        edges.forEach(function(edge){
            edge.value = cm.value;
            setEquivalentMetricEdges(graph, edge);
        });	       
	});
	
	// if there is no counter metric, assign it a mean value, along with a flag that says it is a derived value
	edges.forEach(function(edge){
		if (!edge.value) {
			edge.value = quartile1;
		} else if (edge.value === "0") {
			edge.value = 0.45;
			edge.realValue = 0;
		} 
			
	});

	return graph;
};

// augment arr with arr2's items
function pushArray(arr, arr2) {
  arr.push.apply(arr, arr2);
}

// edgeMap key for edge
function edgeKey(edge) {
    return edge.sourceId + "," + edge.targetId;
}

// edgeMap key for all edges whose targetId === opId
function incomingEdgesKey(opId) {
    return "*," + opId;
}

// edgeMap key for all edges whose sourceId === opId
function outgoingEdgesKey(opId) {
    return opId + ",*";
}

// make edge map of:
// - edgeKey(edge) -> edge
// - incomingEdgesKey(edge.targetId) -> edge.targetId incoming edges[]
// - outgoingEdgesKey(edge.sourceId) -> edge.sourceId outgoing edges[]
//
function makeEdgeMap(edges) {
    var edgeMap = {};
    edges.forEach(function(edge){
        edgeMap[edgeKey(edge)] = edge;
        addToEdges(edgeMap, edge, incomingEdgesKey(edge.targetId));
        addToEdges(edgeMap, edge, outgoingEdgesKey(edge.sourceId));
    });
    return edgeMap;
}

// add edge to edgeMap[key]'s edges[]
function addToEdges(edgeMap, edge, key) {
    var edges = edgeMap[key];
    if (edges == null) {
        edges = [];
        edgeMap[key] = edges;
    }
    edges.push(edge);
}

// make vertex map of opId -> vertex
function makeVertexMap(vertices) {
    var vertexMap = {};
    vertices.forEach(function(vertex){
        vertexMap[vertex.id] = vertex;
    });
    return vertexMap;
}

// make edge map of:
// - cmOutputEdge -> equiv downstream edges[]
// - cmInputEdge -> equiv upstream edges[]
function makeEquivMetricEdgeMap(graph, counterMetrics) {
    var map = {};
    counterMetrics.forEach(function(cm){
        var edges = graph.edgeMap[outgoingEdgesKey(cm.opId)];
        var edge = edges[0];
        map[edgeKey(edge)] = collectEquivMetricEdges(graph, edge, true);
        
        var edges = graph.edgeMap[incomingEdgesKey(cm.opId)];
        var edge = edges[0];
        map[edgeKey(edge)] = collectEquivMetricEdges(graph, edge, false);
    });
    
    return map;
}

// traverse downstream/upstream from "edge" collecting "equivalent" edges.
// Traverses through peek ops.
// Also includes a FanOut oplet's outputs when traversing downstream
// because the runtime doesn't add CounterOps to them.
// requires graph.edgeMap, graph.vertexMap
function collectEquivMetricEdges(graph, edge, isDownstream) {
    var equivEdges = [];
    var vertex = graph.vertexMap[isDownstream ? edge.targetId : edge.sourceId];
    if (isaPeek(vertex)) {
        var key = isDownstream ? outgoingEdgesKey(vertex.id) : incomingEdgesKey(vertex.id);
        var edges = graph.edgeMap[key];
        pushArray(equivEdges, edges);
        edges.forEach(function(e2){
            pushArray(equivEdges, collectEquivMetricEdges(graph, e2, isDownstream));
        });
    }
    else if (isDownstream
            && vertex.invocation.kind == "quarks.oplet.core.FanOut") {
        pushArray(equivEdges, graph.edgeMap[outgoingEdgesKey(vertex.id)]);
    }
    return equivEdges;
}

// set the metricEdge's value in all edges equivalent to it.
// requires graph.equivMetricEdgeMap
function setEquivalentMetricEdges(graph, metricEdge) {
    var edges = graph.equivMetricEdgeMap[edgeKey(metricEdge)];
    edges.forEach(function(edge){
        edge.value = metricEdge.value;
    });
}

function isaPeek(vertex) {
  // TODO need an oplet tag or something to generalize this
  var kind = vertex.invocation.kind;
  return kind === "quarks.streamscope.oplets.StreamScope"
      || kind === "quarks.oplet.functional.Peek"
      || kind === "quarks.metrics.oplet.RateMeter"
      || kind === "quarks.metrics.oplet.CounterOp";
}

getVertexFillColor = function(layer, data, cMetrics) {
	if (layer === "opletColor" || layer === "static") {
		return opletColor[data.invocation.kind];
	} else if (layer === "flow") {
		var tupleValue = parseInt(data.value, 10);
		var derived = data.derived ? true : false;
		var isZero = data.realValue === 0 && d.value === 0.45 ? true : false;
		var tupleBucketsIdx = getTupleCountBucketsIndex(cMetrics, tupleValue, derived, isZero);

		var myScale = d3.scale.linear().domain([0,tupleBucketsIdx.buckets.length -1]).range(tupleColorRange);
		if (data.invocation.kind.toUpperCase().endsWith("COUNTEROP")) {
			return "#c7c7c7";
        } else if (data.invocation.kind.toUpperCase().endsWith("STREAMSCOPE")) {
            return "#c7c7c7";
		} else {
			return myScale(tupleBucketsIdx.bucketIdx);
		}
	} else {
		return colorMap[data.id.toString()];
	}
};

getFormattedTagLegend = function(tArray) {
	var items = [];
	tArray.forEach(function(t){
		var obj = {};
		obj.name = t;
		if (t === MULTIPLE_TAGS_TEXT) {
			obj.fill = MULTIPLE_TAGS_COLOR;
			obj.stroke = MULTIPLE_TAGS_COLOR;
		} else {
			obj.fill = color20(t) === "#c7c7c7" ? "#008080" : color20(t);
			obj.stroke = color20(t) === "#c7c7c7" ? "#008080" : color20(t);
		}
		items.push(obj);
	});
	return items;
};

getFormattedTupleLegend = function(metricBuckets, scale) {
	var items = [];
	var buckets = metricBuckets.buckets;
	buckets.forEach(function(b){
		var obj = {};
		obj.name = b.name;
		obj.fill = scale(b.id);
		obj.stroke = scale(b.id);
		obj.idx = b.id;
		items.push(obj);
	});
	
	var sortFunction = function(a, b) {
		 if (a.idx < b.idx)  {
 	    	return -1;
 	     } else if (a.idx > b.idx) {
 	    	return 1;
 	     } else {
 	    	return 0;
 	    }
	};
	return items.sort(sortFunction);
};

getLegendText = function(layer, data) {
	if (layer === "opletColor" || layer === "static") {
		return parseOpletKind(data.invocation.kind);
	} else {
		return "";
	}
};

parseOpletKind = function(kind) {
	var returnName = kind;
	var newNames = kind.split(".");
	if (newNames.length > 1) {
		returnName = newNames[newNames.length - 1];
		returnName += " (";
		for (var i = 0; i < newNames.length -1; i++) {
			returnName += newNames[i] + ".";
		}
		returnName = returnName.substring(0, returnName.length -1);
		returnName += ")";
	}
	return returnName;
};

getLegendColor = function(layer, d, cMetrics) {
	return getVertexFillColor(layer, d, cMetrics);
};


setVertexColorByFlowRate = function() {
	
};

makeStaticFlowValues = function(numValues) {
	var littleVal = 0.001;
	var data = d3.range(numValues).map(function() {
		return littleVal;
		});
	return data;
};

makeRandomFlowValues = function(numValues) {
	var random = d3.random.normal(5000, 2000);
	var data = d3.range(numValues).map(random);
	return data;
};

hideElement = function(elementId){
	var id = "#" + elementId;
	d3.select(id).style("display", "none");
};

showElement = function(elementId) {
	var id = "#" + elementId;
	d3.select(id).style("display", "block");
};

