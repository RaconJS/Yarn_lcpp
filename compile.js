function compile(text,throwError){
	throwError ??= (msg = "", errorFunction = a => Error(a)) => {throw errorFunction(msg)};
	const regex = /(λ|\\|>)|\b\w+\b|[+\-*&|^!]{2}|"(?:[^"]|\\")*"|'(?:[^']|\\')*'|\/\*[\s\S]*\*\/|\/\/.*|\S|\s+/g;
	class File{//used for error data
		constructor(name){
			this.name = name;
		}
		words;//:WordSymbol[]
		lines;//:#
		
	};
	class WordSymbol extends String{
		constructor(data={}){super(data.word);Object.assign(this,data);}
		word;//:string
		type;//:"" | "whiteSpace" | "comment" | "bracket" | "function" | "label" | "number" | "string"
		subType;//:"" | when (type:"bracket") : "open" | "close"
		
		//error data
		line;//:Number ; counts from 1
		column;//:Number ; counts from 1
		file;//:File
		throwError(errorType,errorMessage,errorFunc,stack=undefined){
			throwError(
				"lc++ ERROR:\n"
				+"l:"+this.line+" c:"+this.column+"\n"
				// " ".repeat(lineLen)+" |\n"
				+this.display_markWordInLine(errorType+" error")+"\n"
				+"error"+": "+errorMessage+"\n"
			,errorFunc);
		}
		display_markWordInLine(lineRaw){
			let line = this.file.lines[this.line-1].replace(/^\s*/,"");
			return line+"\n"+line.substr(0,this.column-1).replaceAll(/./g," ")+"^".repeat(this.word.length);
		}
	}
	const file = new File("");
	const words = ((text,regex,file)=>{
		let words = [];
		let column = 1, line = 1;
		([...text.matchAll(regex)]??[]).forEach(v=>{
			let word = v[0];
			let wordSymbol = new WordSymbol({
				word,
				column,line,file,
				match:v,
				type:
					word.match(/\s+/)?"whiteSpace":
					word.match(/^\/[/*]/)?"comment":
					word.match(/^[()\[\]{}]$/)?"bracket":
					word.match(/^[λ\\]$/)?"function":
					word.match(/^>$/)?"function":
					word.match(/\b\w+\b/)?"label":
					word.match(/\b[0-9]+\b/)?"number":
					""
				,
				subType:
					word.match(/^[λ\\]$/)?"unnamedParameter":
					word.match(/^>$/)?"namedParameter":
					word.match(/^[(\[{]$/)?"open":
					word.match(/^[)\]}]$/)?"close":
					""
				,
			});
			if(word.match("\n")){
				column = word.match(/(?<=\n)[\s\S]*$/).length+1;
				line+=word.matchAll("\n").length;
			}else column+=word.length;
			words.push(wordSymbol);
		});
		file.words = words;
		return words;
	})(text,regex,file);
	const syntaxTree = ((words)=>{//()->syntaxTree:{word:String,type:string,subType:string}[]
		let treePartList = [[]];
		let bracketLevel = 0;
		file.lines = text.split("\n");
		let syntaxTree = words.forEach(wordSymbol=>{
			if("\"'`".includes(wordSymbol+""))wordSymbol.throwError("syntax","missing closing quote in string",a=>Error(a));
			if(wordSymbol.type == "comment" || wordSymbol.type == "whiteSpace")return;
			treePartList[treePartList.length-1].push(wordSymbol);
			if(wordSymbol.type == "bracket"){
				if(wordSymbol.subType == "open")treePartList.push([]);
				if(wordSymbol.subType == "close"){
					if(treePartList.length == 1)wordSymbol.throwError("syntax","too many closing brackets",a=>Error(a));
					treePartList.pop();
				}
			}
		});
		return treePartList[0];
	})(words);
	const patterns = ((syntaxTree)=>{
		;
	})(syntaxTree);
}
compile("'abc\" ' hello world'")