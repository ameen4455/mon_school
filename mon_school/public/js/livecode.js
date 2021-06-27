const LIVECODE_CODEMIRROR_OPTIONS = {
  lineNumbers: true,
  keyMap: "sublime",
  mode: "python",
  matchBrackets: true,
  indentWithTabs: false,
  tabSize: 4,
  indentUnit: 4,
  extraKeys: {
    Tab: (cm) => {
      cm.somethingSelected()
      ? cm.execCommand('indentMore')
      : cm.execCommand('insertSoftTab');
    }
  }
}

// Initialized the editor and all controls.
// It is expected that the given element is a parent element
// with textarea, div.output, button.run optionally canvas.canvas
// elements in it.
class LiveCodeEditor {
  constructor(element, options) {
    this.options = options;
    this.parent = element;

    this.base_url = options.base_url;
    this.runtime = options.runtime;

    this.files = options.files || [];
    this.env = options.env || {};
    this.command = options.command || null;

    this.elementCode = this.parent.querySelector(".code");
    this.elementOutput = this.parent.querySelector(".output");
    this.elementRun = this.parent.querySelector(".run");
    this.elementRunStatus = this.parent.querySelector(".run-status");
    this.elementClear = this.parent.querySelector(".clear");
    this.elementReset = this.parent.querySelector(".reset");
    this.elementSVG = this.parent.querySelector(".svg-image svg");
    this.codemirror = null;
    this.autosaveTimeoutId = null;
    this.setupActions()
  }
  reset() {
    this.clearOutput();
    this.clearImage();
  }
  run() {
    this.triggerEvent("beforeRun");
    this.reset();
    this.runCode(this.getCode());
  }
  runCode(code) {
    this.clearOutput();
    this.clearImage();

    this.showRunMessage("Running...");
    var data = {
      code: code,
      is_sketch: this.runtime == "sketch"
    }
    fetch("/api/method/mon_school.mon_school.livecode.execute", {
      method: "POST",
      headers: {
        "Content-type": "application/json",
        "X-Frappe-CSRF-Token": frappe.csrf_token
      },
      body: JSON.stringify(data)
    })
    .then(r => r.json())
    .then(data => {
      this.showRunMessage("");
      if (data._server_messages) {
        this.showServerMessages(data);
      }
      if (data.message) {
        const msg = data.message;
        this.writeOutput(msg.output.join(""));
        this.drawShapes(msg.shapes);
      }
    })
    .catch(err => {
      console.log(err);
      window.err = err;
      if (this.isNetworkError(err)) {
        this.showRunMessage("Unable to run the code due to network error.");
      }
      else {
        this.showRunMessage("Error: " + err.message);
      }
    })
  }
  showRunMessage(msg) {
    this.elementRunStatus.innerHTML = msg;
  }
  isNetworkError(err) {
    return (err instanceof TypeError)  && err.message.includes("NetworkError")
  }
  showServerMessages(data) {
    if (data._server_messages) {
      var server_messages = JSON.parse(data._server_messages || '[]');

      server_messages = server_messages.map((msg) => {
        // temp fix for messages sent as dict
        try {
          var d = JSON.parse(msg);
          return (typeof d === 'object' && d.message) ? d.message: d;
        } catch (e) {
          return msg;
        }
      }).join('<br>');

      this.showRunMessage(server_messages);
    }
  }

  triggerEvent(name) {
      var events = this.options.events;
      if (events && events[name]) {
	      events[name](this);
      }
  }
  setupActions() {
    this.elementRun.onclick = () => this.run();
    if (this.elementClear) {
	    this.elementClear.onclick = () => this.triggerEvent("clear");
    }
    if (this.elementReset) {
	    this.elementReset.onclick = () => this.triggerEvent("reset");
    }

    if (this.options.codemirror) {
      const options = {
        ...LIVECODE_CODEMIRROR_OPTIONS,
      }
      if (this.options.codemirror instanceof Object) {
        options = {...options, ...this.options.codemirror}
      }
      options.extraKeys['Cmd-Enter'] = () => this.run()
      options.extraKeys['Ctrl-Enter'] = () => this.run()

      this.codemirror = CodeMirror.fromTextArea(this.elementCode, options)

      // if (this.options.autosave) {
      //   this.codemirror.on('change', (cm, change) => {
      //     if (this.autosaveTimeoutId) {
      //       clearTimeout(this.autosaveTimeoutId);
      //     }
      //     this.autosaveTimeoutId = setTimeout(() => {
      //       let code = this.codemirror.doc.getValue();
      //       this.options.autosave(this, code);
      //     }, 3000)
      //   })
      // }
    }
  }

  getCode() {
    if (this.codemirror) {
      var code = this.codemirror.doc.getValue()
      return code.replaceAll("\t", " ".repeat(this.codemirror.options.indentUnit))
    }
    else {
      return this.elementCode.value;
    }
  }

  clearOutput() {
    if (this.elementOutput) {
      this.elementOutput.innerHTML = "";
    }
  }
  clearImage() {
    if (this.elementSVG) {
      this.elementSVG.innerHTML = "";
    }
  }

  writeOutput(output_text) {
    // escape HTML
    var html = new Option(output_text).innerHTML;
    if (this.elementOutput) {
      this.elementOutput.innerHTML = html;
    }
  }
  drawShapes(shapes) {
    // const svgElement = editor.parent.querySelector("div.svg-image svg");
    this.elementSVG.innerHTML = "";
    shapes.forEach((s) => {
      this.elementSVG.innerHTML += this.renderShape(s);
    })
  }
  renderShape(shape) {
    var tag = shape.tag;
    var children = shape.children;
    var attrs = {...shape};
    delete attrs.tag;
    delete attrs.children;

    var svg = `<${tag}`
    Object.entries(attrs).forEach(([name, value]) => {
      name = name.replace("_", "-");
      svg += ` ${name}="${value}"`
    })

    if (children && children.length) {
      svg += ">\n"
      children.forEach(node => {
        svg += this.renderShape(node);
      })
      svg += `</${tag}>`;
    }
    else {
      svg += "/>";
    }
    return svg;
  }
}
