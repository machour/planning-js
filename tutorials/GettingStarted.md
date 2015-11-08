```html
    <canvas id="canvas" width="1200" height="600"></canvas>
    <div id="log">a</div>
```

```javascript

var p = new Planning({
  selector: 'canvas'
});

// Let's add 20 rows
for (var i = 1; i <= 20; i++) {
  p.addRow({id: i, label: 'Row #' + i});
}

// Register a rental type, with it's own default configuration
p.registerItemType('rental', {
  status: 'ongoing',
  text: 'unknown',
  background: '#bfe2ca',
  color: '#333',
  onclick: function(item) {
      console.log(item);
  }
});

// Register another type
p.registerItemType('repair', {
  status: 'ongoing',
  text: 'unknown',
  background: '#a6daef',
  color: '#333',
  onclick: function(item) {
      console.log(item);
  }
});

p.addItem('rental', {id: 344, row: 3, start: 1444716000, end: 1444844800, text: 'Mr Foobar'});
p.addItem('repair', {id: 345, row: 4, start: 1444796000, end: 1444964800, text: 'Repair'});

p.draw();
      
```
