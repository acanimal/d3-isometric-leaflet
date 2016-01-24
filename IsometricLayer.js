
L.IsometricLayer = L.Class.extend({

  includes: [L.Mixin.Events],

  options: {
    size: 10,
    maxHeight: 100
  },

  initialize: function (data, options) {
		L.setOptions(this, options);

    this._data = data;
	},

	onAdd: function (map) {
		this._map = map;

    this._computeDataBounds();
    // Create a container for svg.
    this._initContainer();
    this._offset = L.point([0,0]);

    // Set up events
    map.on({'moveend': function() {
      this._initContainer();
      this._redraw();
    }}, this);
    map.on({'zoomend': function() {
      this._initContainer();
      this._redraw();
    }}, this);

    // Initial draw
    this._redraw();
	},

	addTo: function (map) {
		map.addLayer(this);
		return this;
	},

	onRemove: function (map) {
    this._destroyContainer();

    // Remove events
    map.off({'moveend': this._redraw}, this);

    this._container = null;
    this._map = null;
	},

  _computeDataBounds: function() {
    this._leftBottom = L.latLng(
      d3.min(data, function(d) { return d.lat; }),
      d3.min(data, function(d) { return d.lon; })
    );
    this._rightTop = L.latLng(
      d3.max(data, function(d) { return d.lat; }),
      d3.max(data, function(d) { return d.lon; })
    );

    var dataRange = [
      d3.min(data, function(d) { return d.value; }),
      d3.max(data, function(d) { return d.value; }),
    ];

    this._valueScale = d3.scale.linear().domain([0, dataRange[1]]).range([0, this.options.maxHeight]);
  },

  _initContainer: function() {

    if (!this._container) {
      this._container = d3.select(this._map.getPanes().overlayPane).append('svg');
    }

    var lb = this._map.latLngToContainerPoint(this._leftBottom);
    var rt = this._map.latLngToContainerPoint(this._rightTop);

    var lt = L.point([lb.x, rt.y]);

    console.log(lb, rt, lt);

    // var width = (rt.x - lb.x) + this.options.size * 2;
    // var height = (lb.y - rt.y) + this.options.maxHeight + this.options.size * 2;

    var mapSize = this._map.getSize();
    var width = mapSize.x;
    var height = mapSize.y;

    if(!this._prevLeftBottom) {
      this._prevLeftBottom = lb.clone()
    }
    var layerOffset = lb.subtract(this._prevLeftBottom);
    this._prevLeftBottom = lb.clone()

    console.log(lb, this._prevLeftBottom, layerOffset)

    var left = (lt.x - this.options.size - this.options.size);
    var top = (lt.y - this.options.maxHeight - this.options.size);


    this._container
      .attr({
        'class': 'leaflet-layer leaflet-zoom-hide isometric-layer',
        'width': width,
        'height': height,
        'viewBox': left +' '+ top + ' ' + width + ' ' + height
      })
      .style({
        'top': -layerOffset.x + "px",
        'left': -layerOffset.y + "px",
        // 'top': -height/2+"px",
        // 'bottom': -height/2+"px"
      });



    this._data = data.map(function(d) {
      var pointLayer = this._map.latLngToLayerPoint([d.lat, d.lon]);
      return {
        origX: pointLayer.x,
        origY: pointLayer.y,
        x: pointLayer.x,
        y: pointLayer.y,
        dx: this.options.size,
        dy: this.options.size,
        dz: this._valueScale(d.value)
      };
    }, this);

    this._computeIsometricPoints(this._data);
  },

  _destroyContainer: function(){
    if(null != this._container){
      this._container.remove();
    }
  },

  _redraw: function() {

    this._DRAW();
  },

  _isometric: function(p3d) {
    var r = [
      -Math.sqrt(3) / 2 * p3d[0] + Math.sqrt(3) / 2 * p3d[1],
      +0.5 * p3d[0] + 0.5 * p3d[1] - p3d[2]
    ];
    return r;
  },

  _computeIsometricPoints: function(data, scale) {
    if (scale == null) {
      scale = 1;
    }
    data.forEach(function(d) {
      return this._parallelepipedon(d, scale);
    }, this);
    return data.sort(function(a, b) {
      return a.iso.far_point[1] - b.iso.far_point[1];
    });
  },

  _path_generator: function(d) {
    return 'M' + d.map(function(p) {
      return p.join(' ');
    }, this).join('L') + 'z';
  },

  _parallelepipedon: function(d) {
    d.x = 0;
    d.y = 0;
    d.z = 0;

    var fb = this._isometric([d.x, d.y, d.z]);
    var mlb = this._isometric([d.x + d.dx, d.y, d.z]);
    var nb = this._isometric([d.x + d.dx, d.y + d.dy, d.z]);
    var mrb = this._isometric([d.x, d.y + d.dy, d.z]);
    var ft = this._isometric([d.x, d.y, d.z + d.dz]);
    var mlt = this._isometric([d.x + d.dx, d.y, d.z + d.dz]);
    var nt = this._isometric([d.x + d.dx, d.y + d.dy, d.z + d.dz]);
    var mrt = this._isometric([d.x, d.y + d.dy, d.z + d.dz]);

    d.iso = {
      face_bottom: [fb, mrb, nb, mlb],
      face_left: [mlb, mlt, nt, nb],
      face_right: [nt, mrt, mrb, nb],
      face_top: [ft, mrt, nt, mlt],
      outline: [ft, mrt, mrb, nb, mlb, mlt],
      far_point: fb
    };

    return d;
  },

  _DRAW: function() {
    var svg = this._container;
    var y_color = d3.scale.category10();

    var pipedons = svg.selectAll('.pipedon').data(this._data);
    var enter_pipedons = pipedons.enter()
      .append('g')
      .attr({
        "class": 'pipedon',
        transform: function(d) {
          return "translate(" + d.origX + "," + d.origY + ")"
        },
      });

    var self = this;

    enter_pipedons.append('circle').attr({
      cx: function(d){
        return d.x;
      },
      cy: function(d) {
        return d.y;
      },
      r: 25
    });

    enter_pipedons.append('path').attr({
      "class": 'iso face bottom',
      d: function(d) {
        return self._path_generator(d.iso.face_bottom);
      }
    });

    enter_pipedons.append('path').attr({
      "class": 'iso face left template',
      d: function(d) {
        return self._path_generator(d.iso.face_left);
      },
      fill: function(d) {
        return y_color(d.dz);
      }
    });

    enter_pipedons.append('path').attr({
      "class": 'iso face right',
      d: function(d) {
        return self._path_generator(d.iso.face_right);
      },
      fill: function(d) {
        var color;
        color = d3.hcl(d3.select(this.parentNode).select('.template').style('fill'));
        return d3.hcl(color.h, color.c, color.l - 12);
      }
    });

    enter_pipedons.append('path').attr({
      "class": 'iso face top',
      d: function(d) {
        return self._path_generator(d.iso.face_top);
      },
      fill: function(d) {
        var color;
        color = d3.hcl(d3.select(this.parentNode).select('.template').style('fill'));
        return d3.hcl(color.h, color.c, color.l + 12);
      }
    });

    enter_pipedons.append('path').attr({
      "class": 'iso outline',
      d: function(d) {
        return self._path_generator(d.iso.outline);
      }
    });

  }

});


L.isometricLayer = function(options) {
	return new L.IsometricLayer(options);
};
