#!/bin/node

import { readFileSync, writeFileSync, lstatSync } from "node:fs";

const args = process.argv.slice(2);
var inputFiles = [],
	outputFile,
	shell = "/bin/bash";

for (let i = 0; i < args.length; i++) {
	switch (args[i]) {
		case "-o":
		case "--output":
			i++;
			outputFile = args[i];
			break;
		case "-e":
		case "--shell":
			i++;
			let sh = args[i];
			shell = sh.startsWith("/") ? sh : `/usr/bin/env ${sh}`;
			break;
		default:
			args[i] == "-" ? inputFiles.push("/dev/stdin") : lstatSync(args[i]).isFile() ? inputFiles.push(args[i]) : console.error(args[i], "is not a valid file path");
			break;
	}
}

class Handler {
	constructor(str) {
		this.pos = 0;
		this.sublevel = "";
		this.str = str;
		return { result: `#!${shell}\n${this.processStr()}` };
	}

	processStr(sublevel = "") {
		let prevpos = 0,
			lastWord = "",
			isInCmd = false,
			tmpStr = "",
			outStr = "";
		for (this.pos = this.pos; this.pos < this.str.length; this.pos++) {
			switch (this.str[this.pos]) {
				// subshell ends
				case ")":
				case "}":
					if (sublevel == this.str[this.pos]) {
						tmpStr += lastWord;
						lastWord = "";
						outStr += tmpStr.trim() + this.str[this.pos];
						tmpStr = "";
						isInCmd = false;
						return outStr;
					} else {
						lastWord += this.str[this.pos];
					}
					break;
				// commenting
				case "#":
					try {
						if (/[ \t\n;]/.test(this.str[this.pos - 1])) this.comment(this.pos);
						else lastWord += "#";
					} catch (e) {
						this.comment(this.pos);
					}
					break;
				// $
				case "$":
					lastWord += "$";
					switch (this.str[this.pos + 1]) {
						case "(":
							lastWord += this.subshell(this.pos + 1);
							break;
						case "{":
							lastWord += this.substitution(this.pos + 1);
							break;
						default:
							break;
					}
					break;
				// double quote string
				case '"':
					lastWord += this.dquote(this.pos);
					break;
				// single quote string
				case "'":
					lastWord += this.squote(this.pos);
					break;
				// expression
				case "[":
					lastWord += this.expression(this.pos);
					break;
				// subshell starts
				case "(":
				case "{":
					lastWord += this.subshell(this.pos, this.str[this.pos]);
					break;
				case "`":
					if (sublevel == "`" && this.str[this.pos] == "`") {
						tmpStr += lastWord;
						lastWord = "";
						outStr += tmpStr.trim() + this.str[this.pos];
						tmpStr = "";
						isInCmd = false;
						return outStr;
					} else {
						lastWord += this.subshell(this.pos, "`");
					}
					break;
				// \
				case "\\":
					switch (this.str[this.pos + 1]) {
						case "\n":
							break;
						default:
							lastWord += `\\${this.str[this.pos + 1]}`;
							break;
					}
					this.pos++;
					break;
				// heredoc
				case "<":
					lastWord += "<";
					try {
						lastWord += this.str[this.pos - 1] == "<" && this.str[this.pos + 1] != "<" ? this.heredoc(this.pos + 1) : "";
					} catch (e) {}
					break;
				// spacing
				case " ":
				case "\t":
					while (/[ \t]/.test(this.str[this.pos + 1])) this.pos++;
					if (isInCmd) {
						isInCmd = true;
						tmpStr += " ";
					} else
						switch (lastWord) {
							case "declare":
							case "export":
							case "local":
								tmpStr += this.define(prevpos);
								break;
							case "case":
								tmpStr += this.case(prevpos);
								break;
							case "for":
							case "while":
							case "select":
							case "until":
								tmpStr += this.loop(prevpos);
								break;
							case "if":
								tmpStr += this.loop(prevpos);
								break;
							case "<<":
							case "<<-":
								tmpStr += this.heredoc(this.pos + 1);
								break;
							default:
								tmpStr += lastWord + " ";
								break;
						}
					lastWord = "";
					break;
				// end
				case "\n":
				case ";":
					if (sublevel != "cond") while (/[ \n\t;]/.test(this.str[this.pos + 1])) this.pos++;
					tmpStr += lastWord;
					lastWord = "";
					outStr += `${tmpStr.trim()};`;
					tmpStr = "";
					isInCmd = false;
					if (sublevel == "cond") return outStr;
					break;
				// variable
				case "=":
					if (lastWord != "") {
						prevpos = this.pos;
						tmpStr += lastWord;
						lastWord = "=";
						if (/['"]{2}/.test(this.str.substr(this.pos, 2))) this.pos += 2;
						break;
					}
				default:
					if (lastWord == "") {
						prevpos = this.pos;
					}
					lastWord += this.nearestThing(this.pos, ")$\"'`\\ \t;\n=");
					break;
			}
		}
		return outStr;
	}

	nearestThing(pos, chars = " \t") {
		let nearest = this.str.length;
		for (const c of chars) {
			let nearestChar = this.str.indexOf(c, pos);
			if (nearestChar != -1 && nearestChar < nearest) nearest = nearestChar;
		}
		this.pos = nearest - 1 || pos;
		return this.str.substring(pos, this.pos + 1);
	}

	define(pos) {
		// Handles local, declare, export
		let tmpStr = "",
			lastWord = "";
		tmpStr += this.nearestThing(pos) + " ";
		this.pos++;

		if (this.str[this.pos + 1].startsWith("-")) {
			tmpStr += this.nearestThing(this.pos + 1) + " ";
			this.pos++;
		}

		this.pos++;

		for (this.pos = this.pos; this.pos < this.str.length; this.pos++) {
			switch (this.str[this.pos]) {
				case "#":
					console.log("encounter");
					try {
						if (/[ \t]/.test(this.str[this.pos - 1])) {
							tmpStr += lastWord;
							lastWord = "";
							this.pos--;
							return tmpStr.trim();
						} else lastWord += "#";
					} catch (e) {
						tmpStr += lastWord;
						lastWord = "";
						this.pos--;
						return tmpStr.trim();
					}
					break;
				case "\n":
				case ";":
					tmpStr += lastWord;
					lastWord = "";
					this.pos--;
					return tmpStr.trim();
				// $
				case "$":
					lastWord += "$";
					switch (this.str[this.pos + 1]) {
						case "(":
							lastWord += this.subshell(this.pos + 1);
							break;
						case "{":
							lastWord += this.substitution(this.pos + 1);
							break;
						default:
							break;
					}
					break;
				// double quote string
				case '"':
					lastWord += this.dquote(this.pos);
					break;
				// single quote string
				case "'":
					lastWord += this.squote(this.pos);
					break;
				// expression
				case "(":
					lastWord += this.expression(this.pos);
					break;
				// subshell starts
				case "`":
					lastWord += this.subshell(this.pos);
					this.sublevel = "`";
					break;
				case " ":
				case "\t":
					while (/[ \t]/.test(this.str[this.pos + 1])) this.pos++;
					tmpStr += lastWord + " ";
					lastWord = "";
					break;
				case "=":
					if (lastWord != "") {
						tmpStr += lastWord;
						lastWord = "";
						if (/['"]{2}/.test(this.str.substr(this.pos, 2))) this.pos += 2;
						else if (/[ \t\n;]/.test(this.str[this.pos + 1])) this.pos++;
						else lastWord = "=";
						break;
					}
				default:
					lastWord += this.nearestThing(this.pos, " \t;\n=");
					break;
			}
		}
		return tmpStr.trim();
	}

	subshell(pos, sublevel) {
		// Handles ``, $(), {}
		// $(()) and (()) are redirected to expression
		this.pos = pos + 1;
		let w = sublevel == "{" ? ["{ ", "}"] : ["(", ")"];
		return this.str[this.pos] == "(" ? this.expression(pos) : `${w[0]}${this.processStr(w[1])}`;
	}

	dquote(pos) {
		// ""
	}

	squote(pos) {
		this.pos = this.str.indexOf("'", pos + 1);
		return this.str.substring(pos, this.pos + 1);
	}

	substitution(pos) {
		// Handles ${var}
	}

	expression(pos) {
		// Handles [], [[]], (())
		this.pos = pos;
	}

	comment(pos) {
		this.pos = this.str.indexOf("\n", pos + 1);
	}

	heredoc(pos) {
		// Handles here documents
		this.pos = pos;
		if (this.str[this.pos] == "-") this.pos++;
	}

	case(pos) {
		// case esac
		let tmpStr = "",
			lastWord = "";
		tmpStr += this.nearestThing(pos) + " ";
		this.pos++;
	}

	loop(pos) {
		// for, while, do
		let tmpStr = "",
			lastWord = "";
		tmpStr += this.nearestThing(pos) + " ";
		this.pos++;
	}

	if(pos) {
		// if
		let tmpStr = "",
			lastWord = "";
		tmpStr += this.nearestThing(pos) + " ";
		this.pos++;
	}
}

const result = new Handler(
	inputFiles
		.map((f) => {
			let content = readFileSync(f, { encoding: "utf8" });
			if (content.startsWith("#!/")) {
				content = content.replace(/^#\!\/.+\n/, "");
			}
			return content;
		})
		.join("\n")
).result;

console.log(result);
