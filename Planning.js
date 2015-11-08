/**
 * Planning
 *
 * @class
 * @param  {Object} options Optional configuration options
 * @return {Planning} Planning main instance
 */
var Planning = (function(options) {

    var main = this;

    /**
     * Options
     * @type {Object}
     */
    this.o = $.extend({
        selector: 'can',
        background: 'whitesmoke',
        lang: 'fr',
        grid: {
            backgroundColor: '#F5F5F5',
            borderColor: '#808080',
            itemPadding: 2,
            itemHeight: 45
        },
        dates: {
            font: '10px Open Sans',
            fontHeight: 7,
            dayHeight: 18,
            dayWidth: 80,
            monthFormat: 'MMMM YYYY',
            monthHeight: 21
        },
        rows: {
            width: 150,
            backgroundColor: '#F5F5F5',
            textColor:  "black",
            font: '12px sans-serif'
        }
    }, options);
    /**
     * Canvas reference
     * @type {HTMLCanvasElement}
     */
    this.canvas = null;
    /**
     * Canvas 2D context reference
     * @type {CanvasRenderingContext2D}
     */
    this.ctx = null;
    /**
     * Whether the grid is being dragged right now
     * @type {boolean}
     */
    this.draggingGrid = false;
    /**
     * Whether an item is being dragged right now
     * @type {boolean}
     */
    this.draggingItem = false; // Keep track of when we are dragging
    this.lastX = 0;
    this.lastY = 0;
    /**
     * The currently selected item
     * @type {Item}
     */
    this.selectedItem = null;
    this.translatedX = 0;
    this.translatedY = 0;
    /**
     * When set to false; the canvas will redraw everything
     * @type {boolean}
     */
    this.valid = false;
    /**
     * X dragging offset
     * @see {@link Planning#listen} for an explanation
     * @type {number}
     */
    this.dragoffx = 0;
    /**
     * Y dragging offset
     * @see {@link Planning#listen} for an explanation
     * @type {number}
     */
    this.dragoffy = 0;
    /**
     * The initial day upon which the planning was built
     * @type {moment}
     */
    this.initialDay = moment({hour: 0, minute: 0, second: 0});
    /**
     * The first day displayed in the grid
     * @type {moment}
     */
    this.firstDay = moment({hour: 0, minute: 0, second: 0});
    this.stylePaddingLeft = 0;
    this.stylePaddingTop = 0;
    this.styleBorderLeft = 0;
    this.styleBorderTop = 0;
    /**
     * The local database
     * @type {loki}
     */
    this.db = new loki('planning.json');
    /**
     * The grid items collection
     * @type {LokiCollection<T>}
     */
    this.items = this.db.addCollection('items');
    /**
     * The rows collection
     * @type {LokiCollection<T>}
     */
    this.rows = this.db.addCollection('rows');
    /**
     * Item types
     * @type {Object}
     */
    this.types = {};

    /**
     * PlanningException class
     *
     * @param message The exception message
     * @constructor
     */
    var PlanningException = function(message) {
        this.message = message;
        this.name = "PlanningException";
        this.toString = function () {
            return "plopplop";
        };
    };

    /**
     * Planning item
     *
     * @class
     * @type {Object}
     */
    this.Item = function(coords, params) {

        var self = this;

        /**
         * The item coordinates
         *
         * @type {Object}
         *
         * @property {Number} x The item x coordinate
         * @property {Number} y The item y coordinate
         * @property {Number} w The item weight
         * @property {Number} h The item height
         */
        this.coords = coords;

        /**
         * The item options
         *
         * @type {Object}
         *
         * @property {String} font The font that will be used
         * @property {String} color=white The item foreground color
         * @property {String} background=#ffcc00 The item background color
         * @property {Number} handlesSize=8 The item handles size
         * @property {Object} selectable={foo:bar}
         * @property {Boolean} selectable.on=true Whether the item is selectable or not
         * @property {String} selectable.color=#ff0000 The selection color
         * @property {Number} selectable.size=2 The selection width
         * @property {String} text=unknown The item text
         * @property {Number} verticalPadding The item vertical padding
         */
        this.o = $.extend({
            font: '11px Verdana',
            color: "white",
            background: "#ffcc00",
            handlesSize: 8,
            selectable: {
                on: true,
                color: '#ff0000',
                size: 2
            },
            text: 'unknown',
            verticalPadding: 0,
            onclick: function() {
                console.log('original called, where is the callback dude ?');
            }
        }, params);


        this.active = false;

        this.valid = false;

        /**
         * Draws the item
         */
        this.draw = function() {

            var s = main.ctx.strokeStyle, f = main.ctx.fillStyle;

            main.ctx.fillStyle = this.o.background;

            // Draw active border if needed
            if (this.o.selectable.on && this.active) {
                main.ctx.strokeStyle = this.o.selectable.color;
                main.ctx.lineWidth = this.o.selectable.size;
            }
            main.roundedRectangle(5, this.coords.x, this.coords.y + this.o.verticalPadding, this.coords.w, this.coords.h - 2 * this.o.verticalPadding);
            main.ctx.fill();
            main.ctx.stroke();

            main.ctx.strokeStyle = this.o.color;

            // Write hours
            main.ctx.lineWidth = 1;
            main.ctx.fillStyle = this.o.color;
            main.ctx.font = this.o.font;

            var start = this.o.momentStart.format("DD H:mm");
            var end = this.o.momentEnd.format("DD H:mm");
            var measure = main.ctx.measureText(end);

            main.ctx.fillText(start, this.coords.x + 2, this.coords.y + 12);
            main.ctx.fillText(this.o.text, this.coords.x + this.coords.w/4, this.coords.y + 26);
            main.ctx.fillText(end, this.coords.x + this.coords.w - measure.width - 2, this.coords.y + this.coords.h - 3);

            main.ctx.strokeStyle = s;
            main.ctx.fillStyle = f;
        };

        this.click = function() {
            if (this.o.selectable.on !== false) {
                this.o.onclick(self);
            }
        };

        this.getCursorStyle = function (mouse) {
            if (main.dist(mouse, main.point(this.coords.x, this.coords.y + this.coords.h / 2)) <= this.o.handlesSize) return 'w-resize';
            if (main.dist(mouse, main.point(this.coords.x + this.coords.w, this.coords.y + this.coords.h / 2)) <= this.o.handlesSize) return 'e-resize';
            return 'move';
        };

    };

    /**
     * Initializes the Planning instance
     */
    this.init = function() {
        moment.locale(this.o.lang);

        // shorthand
        this.o.dates.daysHeight = this.o.dates.dayHeight + this.o.dates.monthHeight;

        this.items.ensureUniqueIndex('id');
        this.rows.ensureUniqueIndex('id');

        this.canvas = document.getElementById(this.o.selector);
        this.canvas.style.background = this.o.background;
        this.o.width = this.canvas.width;
        this.o.height = this.canvas.height;
        this.ctx = this.canvas.getContext('2d');

        if (document.defaultView && document.defaultView.getComputedStyle) {
            this.stylePaddingLeft = parseInt(document.defaultView.getComputedStyle(this.canvas, null)['paddingLeft'], 10)      || 0;
            this.stylePaddingTop  = parseInt(document.defaultView.getComputedStyle(this.canvas, null)['paddingTop'], 10)       || 0;
            this.styleBorderLeft  = parseInt(document.defaultView.getComputedStyle(this.canvas, null)['borderLeftWidth'], 10)  || 0;
            this.styleBorderTop   = parseInt(document.defaultView.getComputedStyle(this.canvas, null)['borderTopWidth'], 10)   || 0;
        }

        this.draw();
        this.listen();
    };

    /**
     * Logs message to the log div
     *
     * @param {string} message The message to be written
     */
    this.log = function(message) {
        document.getElementById('log').innerHTML = message;
    };

    /**
     * Point representation
     *
     * @param {number} x
     * @param {number} y
     *
     * @returns {Object}
     * @property {number} x The x coordinates of the point
     * @property {number} y The y coordinates of the point
     */
    this.point = function(x, y) {
        return {
            x: x,
            y: y
        }
    };

    /**
     * Gets an option
     *
     * @param {string} name The option name
     * @param {string} key An optional key, if provided, options.name.key will be
     *         returned
     * @returns {mixed} Returns the requested option
     */
    this.getOption = function(name, key) {
        key = key || null;
        var ret = null;
        if (key === null) {
            ret = this.o[name];
        } else {
            ret = this.o[name][key];
        }
        if (typeof(ret) === 'undefined') {
            throw new PlanningException("Unknown option requested: " + name + (key ? "/" + key : ""));
        }
        return ret;
    };

    /**
     * Horizontally scrolls the grid
     * @param {number} oldX The old translatedX
     */
    this.hAutoScroll = function(oldX) {
        var item = this.getHoveredItem();
        if (!item) return;
        if (item.coords.x > oldX) {
            if (item.coords.x + item.coords.w + main.translatedX > main.o.width) {
                main.ctx.translate(-20, 0);
                main.translatedX -= 20;
            }
        } else {
            if (item.coords.x + main.translatedX < main.o.rows.width) {
                main.ctx.translate(20, 0);
                main.translatedX += 20;
            }
        }
    };

    /**
     * Sets the cursor style on the canvas
     * @param {string} style A CSS expression for the cursor: property
     */
    this.setCursorStyle = function(style) {
        p.canvas.style.cursor = style;
    };

    /**
     * Draws a rounded rectangle
     *
     * @param {CanvasRenderingContext2D} ctx The canvas 2D context
     * @param {int} radius The border-radius
     * @param {int} x The x-coordinate of the upper-left corner of the rectangle
     * @param {int} y The y-coordinate of the upper-left corner of the rectangle
     * @param {int} w The width of the rectangle, in pixels
     * @param {int} h The height of the rectangle, in pixels
     */
    this.roundedRectangle = function(radius, x, y, w, h) {
        // Draw rounded rectangle
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + w - radius, y);
        this.ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        this.ctx.lineTo(x + w, y + h - radius);
        this.ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        this.ctx.lineTo(x + radius, y + h);
        this.ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
    };

    /**
     * Computes the distance between two points
     *
     * @param {Object} p1 The first point
     * @param {Object} p2 The second point
     * @returns {number} Returns the distance between the two given points
     */
    this.dist = function(p1, p2) {
        return Math.sqrt((p2.x - p1.x) * (p2.x - p1.x) + (p2.y - p1.y) * (p2.y - p1.y));
    };

    /**
     * Listen to the mighty mouse
     *
     */
    this.listen = function() {

        this.canvas.addEventListener('mousewheel', function (e) {
            return; // not ready yet
            var y = main.o.grid.itemHeight * (e.wheelDeltaY < 0 ? 1 : -1) / 5;


            main.scroll(100, main.translatedY - y);
            e.preventDefault();
            main.draw();

            return false;
        });

        this.canvas.addEventListener('mousemove', function (e) {
            main._mousemove(e);
        }, false);

        this.canvas.addEventListener('mouseup', function () {
            main._mouseup();
        }, false);

        this.canvas.addEventListener('mouseleave', function () {
            main._mouseleave();
        }, false);

        this.canvas.addEventListener('mousedown', function (e) {
            main._mousedown(e);
        }, false);
    };

    /**
     * MouseMove event handler
     * @param {Event} e The mouse event
     * @private
     */
    this._mousemove = function(e) {
        var evt = e || event;
        main.mouse = main.getMouse(e);

        main.log('translatedX= ' + main.translatedX + ', x=' + main.mouse.x + ', y=' + main.mouse.y + ' , d=' + main.getXMoment(main.mouse.x).format('DD/MM/YYYY H:mm'));

        if (main.draggingItem) {
            var item = main.selectedItem;
            main.setCursorStyle(item.getCursorStyle(main.mouse));

            var oldX = item.coords.x;
            if (e.shiftKey) {
                var oldY = item.coords.y;
                // We don't want to drag the object by its top-left corner, we want to drag it
                // from where we clicked. That's why we saved the offset and use it here
                item.coords.x = main.mouse.x - main.dragoffx;
                item.o.momentStart = main.getXMoment(item.coords.x);

                // Automatically scroll right or left if needed
                main.hAutoScroll(oldX);

                // Automatically scroll up or down if needed
                var ratio = Math.round((main.mouse.y - main.dragoffy) / main.o.grid.itemHeight);
                var moveby = 20;

                var newY = main.o.dates.daysHeight +  main.o.grid.itemHeight * (ratio - 1); // + main.o.grid.itemPadding;

                console.log(main.mouse.y, main.dragoffy, main.o.grid.itemHeight, 'ratio:'  + ratio, newY);

                if ((main.o.grid.itemHeight * (ratio + 1) + main.o.grid.itemPadding) <= oldY) {
                    if (((newY) + main.translatedY - main.o.dates.daysHeight < main.o.grid.itemHeight) && ratio > 1) {
                        moveby = main.o.grid.itemHeight;
                        main.ctx.translate(20, moveby);
                        main.translatedY += moveby;
                    }
                } else {
                    if (item.coords.y + main.translatedY  > main.o.height - main.o.dates.daysHeight) {
                        moveby = Math.max(20, main.translatedY);
                        main.ctx.translate(20, -moveby);
                        main.translatedY -= moveby;
                    }
                }

                // Snap vertically to a row
                if (ratio > 0) {
                    item.coords.y = newY;
                }
                main.valid = false; // Something's dragging so we must redraw
            } else {
                console.log('mm: ' + item.getCursorStyle(main.mouse));

                switch (item.getCursorStyle(main.mouse)) {
                    case 'w-resize':
                        var d = main.mouse.x - main.translatedX - item.coords.x;
                        if (item.coords.w - d > 0) {
                            item.coords.x = main.mouse.x - main.translatedX;
                            item.coords.w -= d;
                            main.valid = false; // Something's dragging so we must redraw
                        }
                        break;
                    case 'e-resize':
                        if (main.mouse.x - item.coords.x - main.translatedX > 0) {
                            item.coords.w = main.mouse.x - item.coords.x - main.translatedX;
                            main.valid = false; // Something's dragging so we must redraw
                        }
                        break;
                }

                // Automatically scroll right or left if needed
                main.hAutoScroll(oldX);

            }
            main.draw();
            return;
        }

        if (main.draggingGrid) {

            main.scroll(evt.offsetX, evt.offsetY);
            main.draw();
            return;
        }

        // Change the cursor style if needed
        var hItem = main.getHoveredItem();
        if (hItem) {
            main.setCursorStyle(hItem.getCursorStyle(main.mouse));
            main.valid = false;
            main.draw();
        } else {
            main.setCursorStyle('default');
        }
    };

    /**
     * MouseUp event handler
     * @private
     */
    this._mouseup = function() {
        main.draggingGrid = false;
        main.draggingItem = false;
    };

    /**
     * MouseLeave event handler
     * @private
     */
    this._mouseleave = function() {
        main.draggingGrid = false;
        main.draggingItem = false;
    };

    /**
     * MouseDown event handler
     * @param {Event} e The mouse event
     * @private
     */
    this._mousedown = function(e) {
        var item = main.getHoveredItem();
        if (item) {
            console.log('found element !', item);
            item.click();
            main.selectedItem = item;
            // Keep track of where in the object we clicked
            // so we canvas move it smoothly (see mousemove)
            main.dragoffx = main.mouse.x - item.coords.x;
            main.dragoffy = main.mouse.y - item.coords.y;
            main.draggingItem = true;
            main.draggingGrid = false;
            main.valid = false;
            return;
        }

        var evt = e || event;
        main.draggingItem = false;
        main.draggingGrid = true;
        main.lastX = evt.offsetX;
        main.lastY = evt.offsetY;
    };

    /**
     * Returns the translated mouse coordinates
     *
     * @param {Event} e The original mouse event
     * @returns {Object}
     */
    this.getMouse = function(e) {
        var element = this.canvas, offsetX = 0, offsetY = 0, mx, my;

        // Compute the total offset
        if (element.offsetParent !== undefined) {
            do {
                offsetX += element.offsetLeft;
                offsetY += element.offsetTop;
            } while ((element = element.offsetParent));
        }

        // Add padding and border style widths to offset
        // Also add the <html> offsets in case there's a position:fixed bar
        offsetX += this.stylePaddingLeft + this.styleBorderLeft + document.body.parentNode.offsetLeft;
        offsetY += this.stylePaddingTop + this.styleBorderTop + document.body.parentNode.offsetTop;

        offsetX += this.translatedX;
        offsetY += this.translatedY;

        mx = e.pageX - offsetX;
        my = e.pageY - offsetY;

        return this.point(mx, my);
    };

    /**
     * Scrolls the grid horizontally and vertically
     *
     * @param {number} offsetX The horizontal offset
     * @param {number} offsetY The vertical offset
     */
    this.scroll = function (offsetX, offsetY) {
        var deltaX = offsetX - this.lastX;
        this.translatedX += deltaX;
        this.lastX = offsetX;

        this.firstDay = this.initialDay.clone().add(Math.floor(- this.translatedX / this.o.dates.dayWidth), 'd');

        var deltaY = offsetY - this.lastY;
        this.translatedY += deltaY;
        this.lastY = offsetY;

        // block scrolling top
        if (this.translatedY > 0)     {
            this.ctx.translate(deltaX, 0);
            this.translatedY -= deltaY;
        } else if (-this.translatedY > (this.rows.length * this.o.grid.itemHeight) - (this.o.height - this.o.dates.daysHeight)) {
            this.ctx.translate(deltaX, 0);
            this.translatedY -= deltaY;
        } else {
            this.ctx.translate(deltaX, deltaY);
        }

        this.valid = false;

    };

    /**
     * Draws the grid
     */
    this.drawGrid = function() {

        var x;

        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 0.5;
        this.ctx.fillStyle = '#000000';

        // Draw lines
        var y;
        var rows = this.rows.chain().data();
        for (var line = 1; line < rows.length + 1; line++) {
            y = this.o.dates.daysHeight + line * this.o.grid.itemHeight;
            if ((y + this.translatedY) < this.o.dates.daysHeight) continue;
            this.ctx.moveTo(-this.translatedX, y);
            this.ctx.lineTo(this.canvas.width - this.translatedX, y);
        }

        var day;
        for (var i = 1; i < Math.ceil(this.o.width / this.o.dates.dayWidth); i++) {
            day = this.firstDay.clone().add(i, 'd');
            day.set({hour: 0, minute: 0, second: 0});

            x = this.getMomentX(day);

            // Draw days separators
            this.ctx.moveTo(x, this.o.dates.monthHeight - this.translatedY);
            this.ctx.lineTo(x, this.canvas.height - this.translatedY);
        }

        this.ctx.stroke();

    };

    /**
     * Draws the dates
     */
    this.drawDates = function() {

        /*var my_gradient=this.ctx.createLinearGradient(0,-this.translatedY,0,-this.translatedY + this.o.dates.daysHeight);
         my_gradient.addColorStop(0,"#CCC");
         my_gradient.addColorStop(0.1,"#BCBCBC");
         my_gradient.addColorStop(0.5,"#BBB");
         my_gradient.addColorStop(0.9,"#BCBCBC");
         my_gradient.addColorStop(1,"#CCC");*/
        this.ctx.fillStyle = '#EBEBEB';
        this.ctx.beginPath();
        this.ctx.rect(-this.translatedX + this.o.rows.width, -this.translatedY, this.o.width - this.o.rows.width, this.o.dates.daysHeight);
        this.ctx.fill();


        var currentMonth = this.firstDay.format(this.o.dates.monthFormat);
        this.ctx.font= this.o.dates.font;

        var x;

        var day, dayNumber;
        var dayText, measure, dayX, dayY;

        var sepX;
        var sepY = -this.translatedY + this.o.dates.monthHeight + .5;

        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 0.5;
        this.ctx.fillStyle = '#000000';

        // Draw Month/Days separator
        this.ctx.moveTo(this.o.rows.width - this.translatedX, sepY);
        this.ctx.lineTo(this.canvas.width - this.translatedX, sepY);

        var b, c;
        for (var i = 1; i < Math.ceil(this.o.width / this.o.dates.dayWidth); i++) {
            day = this.firstDay.clone().add(i - 1, 'd');
            day.set({hour: 0, minute: 0, second: 0});
            dayNumber = day.format('D');

            x = this.getMomentX(day);

            // Draw days separators
            this.ctx.moveTo(x, this.o.dates.monthHeight - this.translatedY);
            this.ctx.lineTo(x, this.o.dates.daysHeight - this.translatedY);

            // Draw current fixed month
            if (i == 1) {
                b = day.clone();
                b.add(1, 'd');
                c = b.clone();
                c.add(1, 'd');
                if (b.format('D') != 1 && c.format('D') != 1) {
                    this.ctx.fillText(currentMonth, this.o.rows.width - this.translatedX, 15 - this.translatedY);
                }
            }
            // And previous or next month
            if (dayNumber == 1) {
                // x axis
                sepX = x - 5.5;
                this.ctx.moveTo(sepX, -this.translatedY + 0.5);
                this.ctx.lineTo(sepX, sepY);
                //this.ctx.stroke();
                if (i > 1) {
                    this.ctx.fillText(day.format(this.o.dates.monthFormat), x, 15 - this.translatedY);
                }
            }

            // Draw day
            dayText = day.format('dd').substr(0, 1).toUpperCase() + ' ' + dayNumber;
            measure = this.ctx.measureText(dayText);
            dayX = x + (this.o.dates.dayWidth - measure.width) / 2;
            dayY = this.o.dates.monthHeight + (this.o.dates.dayHeight - ((this.o.dates.dayHeight - this.o.dates.fontHeight) / 2)) - this.translatedY;
            this.ctx.fillText(dayText, dayX, dayY);
        }

        this.ctx.stroke();

    };

    /**
     * Gets the moment associated with an x coordinate
     *
     * @param {int} x The X coordinate
     * @returns {moment} The moment instance
     */
    this.getXMoment = function(x) {
        var f = this.initialDay.clone();
        f.set({hour: 0, minute: 0, second: 0});

        var ratio = (x - this.o.rows.width) / this.o.dates.dayWidth;
        var days = Math.floor(ratio);
        var hours = Math.floor((ratio - days) * 24);
        var minutes = (ratio - days - (hours / 24)) * 60 * 24;

        f.add(days, 'd');
        f.add(hours, 'h');
        f.add(minutes, 'm');

        return f.clone();
    };

    /**
     * Gets the x coordinate associated with a moment
     *
     * @param {moment} date The moment instance
     * @returns {int} The X coordinate
     */
    this.getMomentX = function(date) {
        var f = this.firstDay.clone();
        //noinspection JSUnresolvedFunction
        var ms = date.diff(f);

        var secondsInDay = 24 * 60 * 60;

        return Math.floor(this.o.rows.width +
            (
                moment.utc(ms).unix()
                -
                Math.ceil(this.translatedX / this.o.dates.dayWidth) * secondsInDay
            )
            * this.o.dates.dayWidth / secondsInDay);
    };

    /**
     * Draws the whole frame
     */
    this.drawFrame = function() {
        this.ctx.clearRect(-this.translatedX, -this.translatedY, this.o.width, this.o.height);
        this.ctx.rect(-this.translatedX + this.o.rows.width, -this.translatedY + this.o.dates.daysHeight, this.o.width, this.o.height);
    };

    /**
     * Gets the currently hovered item
     *
     * @returns {Planning.Item} The hovered item, or FALSE if none found
     */
    this.getHoveredItem = function() {
        return this.getItemAt(main.mouse);
    };

    /**
     * Gets the item at the given point
     * @param {Object} point
     * @returns {Planning.Item}
     */
    this.getItemAt = function(point) {
        var result = this.items.chain().where(function (obj) {
            return  (obj.coords.x <= point.x) && (obj.coords.x + obj.coords.w >= point.x) &&
                (obj.coords.y <= point.y) && (obj.coords.y + obj.coords.h >= point.y);
        }).data();
        if (result.length == 1) {
            return result[0];
        }
        return false;
    };

    /**
     * Gets all visible items on the grid
     *
     * @returns {array}
     */
    this.getVisibleItems = function() {
        var offsetX = this.translatedX;
        var cWidth = this.o.width;
        var offsetY = this.translatedY;
        var cHeight = this.o.height;

        return this.items.chain().where(function(obj) {
            return !(obj.coords.x + offsetX > cWidth || obj.coords.x + obj.coords.w + offsetX < 0
            ||
            obj.coords.y + offsetY > cHeight || obj.coords.y + obj.coords.h + offsetY < 0)
        }).data();
    };

    /**
     * Draws the items on the grid
     */
    this.drawItems = function() {
        var visibleItems = this.getVisibleItems();
        for (var i = 0; i < visibleItems.length; i++) {
            visibleItems[i].draw();
        }
    };

    /**
     * Adds a row in the rows collection
     * @param {Object} params The row's parameters
     */
    this.addRow = function(params) {
        this.rows.insert(params);
    };

    /**
     * Draws the rows elements
     */
    this.drawRows = function() {
        this.ctx.fillStyle = this.o.rows.backgroundColor;
        this.ctx.beginPath();
        this.ctx.rect(-this.translatedX, 0, this.o.rows.width, this.o.height);
        this.ctx.fill();

        var rows = this.rows.chain().data();
        var renderer;
        for (var i = 0; i < rows.length; i++) {

            this.ctx.fillStyle = this.o.rows.backgroundColor;
            this.ctx.beginPath();
            this.ctx.strokeStyle = this.o.grid.borderColor;
            this.ctx.rect(-this.translatedX, (this.o.grid.itemHeight * i) + this.o.dates.daysHeight, this.o.rows.width, this.o.grid.itemHeight);
            this.ctx.stroke();

            renderer = rows[i].renderer || function (planning, context, row, index) {
                context.fillStyle = planning.o.rows.textColor;
                context.font = planning.o.rows.font;
                context.fillText(row.label, -planning.translatedX + 12, (planning.o.grid.itemHeight * index) + planning.o.dates.daysHeight + 16);
            };

            renderer(this, this.ctx, rows[i], i);
        }
    };

    /**
     * Draws the canvas
     * @todo Add the .valid check again
     */
    this.draw = function() {
        //if (!this.valid) {
            this.ctx.clearRect(-this.translatedX, -this.translatedY, this.o.width, this.o.height);

            // IMPORTANT: Keep this order !
            this.drawFrame();
            this.drawGrid();
            this.drawItems();
            this.drawRows();
            this.drawDates();

            this.ctx.fillStyle = this.o.rows.backgroundColor;
            this.ctx.beginPath();
            this.ctx.rect(-this.translatedX, -this.translatedY, this.o.rows.width, this.o.dates.daysHeight);
            this.ctx.fill();

            this.valid = true;
        //}
    };

    /**
     * Register an item type
     *
     * @param {String} type The item type identifier
     * @param {Object} config The item type configuration
     */
    this.registerItemType = function(type, config) {
        var item = function(coords, options) {
            main.Item.apply(this, [coords, options]);
        };
        item.prototype = this.Item.prototype;
        item.prototype.constructor = item;
        this.types[type] = [item, config];
    };

    /**
     * Adds a typed item to the grid
     *
     * @param {String} type The item type identifier
     * @param {Object} params The item parameters
     */
    this.addItem = function(type, params) {
        var config = $.extend(this.types[type][1], params);
        var coords = {};
        coords.y = (config.row - 1) * this.o.grid.itemHeight + this.o.dates.daysHeight;
        coords.h = this.o.grid.itemHeight;
        var start = moment.unix(config.start);
        var end = moment.unix(config.end);
        coords.x = this.getMomentX(start);
        coords.w = this.getMomentX(end) - coords.x;
        config.momentStart = start;
        config.momentEnd = end;
        var item = new this.types[type][0](coords, config);
        this.items.insert(item);
        this.valid = false;
    };

    //noinspection JSUnusedGlobalSymbols
    this.setFirstDay = function(date) {
        this.firstDay = date;
        this.translatedX = -this.getMomentX(date);
        this.valid = false;

       // this.lastX = this.translatedX;

        this.draw();
    };

    /**
     * Toggles the planning in full screen mode.
     *
     * The call to this function must be initiated by a user gesture.
     *
     * @param {HTMLElement} element The element to show in full screen.
     *   This allow you to toggle a container embeding the canvas and other
     *   elements. Defaults to the canvas.
     */
    this.showFullScreen = function(element) {
        element = element || this.canvas;
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        }
    };

    // Initialize the planning
    this.init();

});
