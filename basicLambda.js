//compiles simple lambda calculus
function loga(...a){console.log(...a);}
function logData(...a){console.log(...a.map(v=>v.toLog?.()??v))}//log data emmits surtain information
function compile(text,throwError){
	throwError ??= (msg = "", errorFunction = a => Error(a)) => {throw errorFunction(msg)};
	const regex = /(λ|\\|>)|\b\w+\b|[+\-*&|^!:]{2}|"(?:[^"]|\\")*"|'(?:[^']|\\')*'|\/\*[\s\S]*\*\/|\/\/.*|\S|\s+/g;
	//classes
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
			type;//:"" | "whiteSpace" | "comment" | "bracket" | "function" | "assignment" | "label" | "number" | "string" | "operator"
			subtype;//:"" | when (type == "bracket") : "open" | "close" | when (type == "function") : "unnamedParameter" | "namedParameter"
			
			//error data
			line;//:Number ; counts from 1
			column;//:Number ; counts from 1
			file;//:File
			//used with type == "bracket" && subtype == "open"
				contence;//:Tree(WordSymbol)
				endBracket;//:WordSymbol
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
			toString(){
				return this.word;
			}
		}
	//----
	const file = new File("");
	const words = ((text,regex,file)=>{
		let words = [];
		let column = 1, line = 1;
		([...text.matchAll(regex)]??[]).forEach(v=>{
			let word = v[0];
			let type;//:string
			let wordSymbol = new WordSymbol({
				word,
				column,line,file,
				match:v,
				type: type = 
					word.match(/\s+/)?"whiteSpace":
					word.match(/^\/[/*]/)?"comment":
					word.match(/^[()\[\]{}]$/)?"bracket":
					word.match(/^([λ\\]|>)$/)?"function":
					word.match(/^\$$/)?"parameterIndex":
					word.match(/^(?:[+\-*^&~|]{1,2}|[/!%]|\w+|\S|={1,2})$/)?"label":
					""
				,
				subtype:
					type == "comment"?"":
					word.match(/^[λ\\]$/)?"unnamedParameter":
					word.match(/^>$/)?"namedParameter":
					word.match(/^[(\[{]$/)?"open":
					word.match(/^[)\]}]$/)?"close":
					word.match(/\b[0-9]+\b/)?"number":
					word.match(/\b\S\b/)?"label":
					""
				,
			});
			if(word.match("\n")){
				column = word.match(/(?<=\n)\N*$/)[0].length+1;
				line+=[...word.matchAll("\n")].length;
			}else column+=word.length;
			words.push(wordSymbol);
		});
		file.words = words;
		return words;
	})(text,regex,file);//:WordSymbol[]
	const getNumber = string => +string;
	const getString = string => string.match(/^(["'])((?:\s\S)+)\1$/)?.[2];
	const syntaxTree = ((words)=>{//()->syntaxTree:{word:String,type:string,subtype:string,contence:syntaxTree?}[]
		let treePartList = [[]];
		let bracketLevel = 0;
		file.lines = text.split("\n");
		let syntaxTree = words.forEach(wordSymbol=>{
			if("\"'`".includes(wordSymbol+""))wordSymbol.throwError("syntax","missing closing quote in string",a=>Error(a));
			if(wordSymbol.type == "comment" || wordSymbol.type == "whiteSpace")return;
			if(wordSymbol.type == "bracket"){
				if(wordSymbol.subtype == "open"){
					treePartList[treePartList.length-1].push(wordSymbol);
					treePartList.push([]);
				}
				if(wordSymbol.subtype == "close"){
					let lastTree = treePartList[treePartList.length-2];
					if({"{":"}","[":"]","(":")"}[lastTree[lastTree.length-1]] != wordSymbol.word)lastTree[lastTree.length-1].throwError("syntax","unmatching brackets '"+lastTree[lastTree.length-1].word+"' '"+wordSymbol.word+"'",a=>Error(a));
					if(treePartList.length == 1)wordSymbol.throwError("syntax","too many closing brackets",a=>Error(a));
					lastTree[lastTree.length-1].contence = treePartList.pop();
					lastTree[lastTree.length-1].endBracket = wordSymbol;
				}
			}
			else treePartList[treePartList.length-1].push(wordSymbol);
		});
		let tree;//temporty variable
		if(treePartList.length>1)(tree=treePartList[0])[tree.length-1].throwError("syntax","unclosed bracket",a=>Error(a));
		return treePartList[0];
	})(words);
	class Pattern{
		static Lambda = class extends Array{
			paramsUsed = new Set();//:Set<number>
			//OBSILETE maxParamUsed = 0;//: number ; represents the length of the context needed to be stored in this lambda; e.g. 'λ$4 $2' -> maxParamUsed = 4
		}
	}
	const patterns = ((syntaxTree)=>{//:Pattern
		return (function recurEachWord(words,patterns,params,functions){
			let oldPatterns = patterns;
			let functions_oldLength = functions.length;
			let addLambda = ()=>{
				let newLambda = new Pattern.Lambda();
				patterns.push(patterns = newLambda);
				functions.push(newLambda);
			};
			let addParamReference = (refLevel)=>{//:(number)-> mutate patterns
				//assume: 'a>a' == 'λ$0'
				patterns.push(refLevel);
				let v;
				for(let i=0;i<functions.length && (v=i-functions.length+1+refLevel)>=0;i++){
					functions[i].paramsUsed.add(v);
				}
			};
			forLoop:for(let i=0;i<words.length;i++){
				let word = words[i];
				if(word.type == "label" && words[i+1]?.type == "function" && words[i+1].subtype == "namedParameter"){// 'a>'
					addLambda();
					params = [...params,word.word];//the "$" is used to stop it mixing with inbuilt object methods
					i+=1;
					continue;
				}
				{
					let isLabel = false;
					if(word.type == "parameterIndex"){// '$1'
						if(words[i+1]?.subtype == "number"){
							addParamReference(getNumber(words[i+1]));
							i+=1;
							continue;
						}
						else isLabel = true;
					}
					if(word.type == "label" || isLabel){
						if(params.includes(word.word)){
							let paramNumber = params.length-1-params.indexOf(word.word);//λ$0 == a>a
							addParamReference(paramNumber);
						}
						else word.throwError("reference", "label '" + word + "' is not refined in this scope",a=>Error(a))
						continue;
					}
				}
				switch(word.type){
					case"function":// 'λ' assert function has unnamed paramater
						addLambda();
					break;
					case"bracket":patterns.push(recurEachWord(word.contence,[],params,functions)); break;
					default:throw Error("compiler error: " + word + ", " + word.type);
				}
			}
			functions.splice(functions_oldLength,functions.length-functions_oldLength);
			return oldPatterns;
		})(syntaxTree,[],[],[]);
		return 0;
	})(syntaxTree);
	const functionObj = ((patterns)=>{
		class Exp extends Array{
			constructor(list = []){
				super();
				this.push(...list);
			}
			call(exp){}
			//context:Exp[]
		}
		class Lazy extends Exp{//:Exp[]
			constructor(list = []){
				super(list);
			}
			call(exp){
				return this.reduce((s,v)=>s.call(v));
			}
		}
		class Lambda extends Exp{//:Tree(number|Exp[])
			constructor(list=[],paramsUsed){
				super(list);
				this.paramsUsed = paramsUsed;
			}
			bracketsToLazy(list,context){
				if(context.length==0)return list;
				return list.map(v=>
					typeof v=="number"? context[v]:
					v instanceof Lambda?
						this.bracketsToLazy(v,v.paramsUsed.map(v=>context[v+1]).filter(v=>!!v)):
					v instanceof Lazy? v:
					v.constructor==Array? this.bracketsToLazy(v,context,level+1):
					throwError("compiler error:","invalid expression",e=>Error(e))
				);
			}
			toLazy(context){
				return new Lazy(this.bracketsToLazy([this])[0]);
			}
			call(exp,context){
				return this.toLazy(this).call(exp);
			}
			paramsUsed;//:number[]
		}
		return function recurEachPattern(scope,patterns,parentFunction){
			for(let pattern of patterns){
				if(pattern instanceof Array){
					let newScope = [];
					if(pattern instanceof Pattern.Lambda)newScope = new Lambda([],(paramsUsed=>{
						let a = [];
						paramsUsed.forEach(v=>a.push(v));
						return a;
					})(pattern.paramsUsed));
					scope.push(recurEachPattern(newScope,pattern));
				}
				else if(typeof pattern == "number")scope.push(pattern);
				else throw Error("compiler error: unhandled or invalid expression:"+pattern);//
			}
			return scope;
		}(new Lazy(),patterns);
	})(patterns);
	loga(functionObj[0])
}
(async ()=>{
	let a = await new Promise((resolve,reject)=>{
		require("fs").readFile("test.lcpp","utf8",(error,data)=>{
			resolve(data);
		});
	});
	if(1)compile(a);
	else try{compile(a)}catch(e){console.log(e+"")};
})();