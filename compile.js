//TEST
const TEST = false;
//UNTESTED
//TODO
//classes
	//Exp: Lambda'λ' | Lazy'()' | Recur'::'
	//OutExp: Lazy
	function findHighestContext(list){//list:Exp[] ; for memory management. finds the deepest parent referenced by an expression
		return list.reduce((s,v)=>Math.max(s,typeof v=="number"?v:s.findHighestContext()),-1);
	}
	class Exp{
		call(arg,context,stack){return arg}
		eval(){return this}
	}
	class Lazy extends Array{//:Exp ; lazy evaluation
		//Lazy : Exp[]
		context;//:Context
		findHighestContext(){
			return this.highestContext?this.highestContext:
				findHighestContext(this);
		}
		constructor(...exps){
			//if(exps.includes(undefined))throw Error("compiler error");
			super(exps.length);
			Object.assign(this,exps);
		}
		//note: all arguments are optional in curtain cases.
		call(arg,context,stack){//(arg:Lazy,Stack)->Lazy
			if(this.length == 1 && this[0] instanceof Lambda)return this[0].call(arg,this.context,stack);
			else return this.eval(stack).call(arg,this.context,stack);
		}//(a>a)(a>a a)
		isReducable(exp){//returns to if exp.eval() != exp
			return exp instanceof Lazy || exp instanceof RecurSetter;
		}
		eval(stack=new Stack()){
			let ans = this;
			{
				//[x],Lazy(x) -> x; where x:Lazy|Array
				while(ans.length != 1?false: ans[0] instanceof Lazy || ans[0].constructor==Array)ans=ans[0];//assume: ans is Tree
				//ans:Lazy|Array
				if(ans.length == 0)return Lambda.null;
			}
			const context = this.context;
			//note this.map first calls 'new Lazy(this.length)' which is overwriten if there is at least 1 item in the expression.
			ans = ans.map(v=>//[]->{call:(arg:Lazy,Stack)->Combinator|Lazy&{call:(Exp,Context,Stack,Number)->Lazy}}[]
				typeof v == "number"?context.getValue(v):
				typeof v == "string"?v://simple raw string cannot be called
				//typeof v == "string"?:
				v instanceof Lambda?Object.assign(new Lazy(v),{context,id:v.id}):
				v instanceof Lazy?v:
				v instanceof Int?v:
				v instanceof NameSpace?v:
				v instanceof List?v:
				v instanceof RecurSetter?v.context?v:Object.assign(new RecurSetter(...v),{recur:v.recur,context,id:v.id}):
				v instanceof Array?Object.assign(new Lazy(...v),{context,id:v.id??this.id}):
				typeof v.call == "function"?v:
				v instanceof Object?(v=>{
					let labels={};
					for(let i in v){
						labels[i]=Object.assign(new Lazy(v[i]),{});
					}
					return new NameSpace(labels);
				})(v):
				v//uncallable object
			).reduce((s,v)=>
				stack.doOnStack(v,stack=>s.call(v,context,stack))
			);
			if(ans instanceof Lazy || ans instanceof RecurSetter){
				while(ans.length == 1 && ans[0] instanceof Lazy || ans[0].constructor instanceof Array)ans=ans[0];//assume: is Tree
				//ans:Lazy|Array
				if(ans.length == 0)ans = Lambda.null;
			}
			return ans;
		}
		toInt(foo,stack){//foo:{call(inc)->{call(0)->Number}}
			return this.constructor.toInt(foo,stack);
		}
		static toInt(foo,stack=new Stack){//foo:{call(inc)->{call(0)->Number}}
			if(foo instanceof Int)return foo;
			const inc = Int.increment;
			const zero = new Int(0);
			return foo.call(inc,undefined,stack).call(zero,undefined,stack);
		}
	}
	class Context{
		static null;//:Context
		constructor(parent,argument,maxRecur){
			Object.assign(this,{
				parent,//:Context?
				argument,//:Lazy|{String->Lazy}|Lazy[]
				maxRecur,//:maxRecur
			});
			this.chainLen=(parent?.level??-1)+1;//:Number
		}
		get maxRecur(){
			return this.maxRecurValue??this.parent?.maxRecur;
		}
		set maxRecur(value){
			this.maxRecurValue = value;
		}
		getContext(num){
			let context = this;
			for(let i=0;i<num;i++){
				context = context.parent;
			}
			return context;
		}
		getValue(num){
			return this.getContext(num).argument;
		}
	}
	Context.null = new Context();
	class Stack extends Array{
		currentMaxRecur = 1;//:Number ; mutable by RecurSetter.prototype.eval
		constructor(...exps){
			super(exps.length);
			Object.assign(this,exps);
		}
		doOnStack(arg,foo){
			let stackableObject = arg;//expression that will be added onto the stack.
			const data = files.getDataFromID[stackableObject.id];
			let oldData = {maxRecur:data?.maxRecur,recurs:data?.recurs};
			if(!this.#add(stackableObject,arg)){
				//note: stack.add already removes the lambda from the stack, so it does not need to be done here.
				//recursion detected
				if(1){
					let file = files.getDataFromID[stackableObject.id].file;
					file.throwError(stackableObject.id,"recursion","unbounded recursion detected",a=>Error(a),this);
				}else return Lambda.null;
			}else {}
			let ans = foo(this);
			this.#remove(stackableObject);
			if(data)Object.assign(data,oldData);
			return ans;
		}
		#add(exp,recurSetter=undefined){
			let id = exp.id;
			if(id!=undefined){
				this.unshift(id);
			}
			else return true;
			//recurSetter:RecurSetter
			const stack = this;
			let recursLeft= exp.context?.maxRecur ?? 1;
			let data = files.getDataFromID[id];
			let maxRecur = data.recurs+recursLeft;
			let [isValid,recurs] = this.stackCheck(data.maxRecur);
			data.recurs = recurs;
			if(recurs <= 1 || maxRecur<data.maxRecur) data.maxRecur = maxRecur;
			if(!isValid){
				this.shift();
				data.recurs--;
			}
			return isValid;
		}
		#remove(lambda){
			if(lambda.id==undefined)return;
			this.shift();
			let data = files.getDataFromID[lambda.id];
			if(data.recurs==0)throw Error("compiler error:"
				+" Possibly, unmatching amounts of add() and remove()."
				+" data.recurs should not be modified elsewhere"
			);
		}
		stackCheck(maxRecur){//only checks last item
			//:Number->[bool,Number]
			let recurs=1;
			let id = this.shift();
			let lastId=this.indexOf(id);
			this.unshift(id);
			if(lastId==-1)return [true,recurs];
			for(let i=lastId+1;i<this.length;){
				let isMatch=true;
				if(this[i]!=id){i++;continue}
				else i++;
				if(i+lastId>this.length){return [true,recurs]}
				if(lastId>0)
				for(let i1=0;i1<lastId;[i1++,i++]){
					if(this[i]!=this[i1+1]){isMatch=false;break;}
				}
				if(isMatch){
					recurs++;
					if(recurs>=maxRecur)return [false,recurs];
				}
			}
			return [true,recurs];
		}
	}
	//code:
		class Lambda extends Array{//:Exp
			constructor(...exps){
				super(exps.length);
				Object.assign(this,exps);
			}
			id;//:number
			static null = new class Null{
				call(arg){return arg}
				eval(){return this}
			};
			findHighestContext(){
				return this.highestContext?this.highestContext:
					findHighestContext(this);
			}
			call(arg=undefined,context=new Context(),stack){
				context = new Context(context,arg);
				return Object.assign(new Lazy(...this),{context,id:this.id}).eval(stack);
			}
			eval(){return this}
			toJS(){
				return function(arg){return this.call(arg)}.bind(this);
			}
		}
		class RecurSetter extends Array{//'value::recur'
			constructor(...list){
				super(list.length);
				Object.assign(this,list);
			}
			recur;//:Exp
			context;//:Context?
			id;//:Number
			getRecursLeft(stack){//()-> finite Number
				return Lazy.toInt(Object.assign(new Lazy(this.recur),{context:this.context,id:this.id}),stack);
			}
			call(arg,context,stack){
				return this.eval(stack).call(arg,context,stack);
			}
			eval(stack=new Stack){;
				let ans = stack.doOnStack(this,stack=>Object.assign(
					new Lazy(...this),{
						context:new Context(this.context,undefined,this.getRecursLeft(stack)),
						id:this.id,
					}
				).eval(stack));
				return ans;
			}
		}
		class NameSpace extends Exp{//'{a b c}' and '{a<=1,b<=2,c<=3}'
			constructor(labels,lazy){//labels:json-like object
				this.labels = new Map(...function*(obj){for(let i in obj)yield [i,obj[i]]}(labels));
				this.lazy = lazy;
			}
			labels;//labels:Map([String],Lazy)
			lazy;//:lazy ()
			call(arg,context,stack){
				if(this.lazy)return this.lazy.call(arg,context,stack);//{a>a a} x -> (a>a a) x
				if(arg instanceof NameSpace)return new NameSpace({...this.labels,...arg.labels},arg.lazy);
				else return arg.call(this);
			}
			eval(){return this}
		}
		class Dot extends Exp{//'a.b'
			constructor(name){
				super();
				this.name=name;//:String
			}
			call(arg,context,stack){
				if(arg instanceof NameSpace)return arg.labels
			}
			eval(){return this}
		}
	class Func extends Exp{//arraw function
		constructor(func,id){
			super();
			this.func=func;
		}
		//isOperater:bool&Operator?
		call(arg,context,stack){//Int->Int-> ... Int-> Int
			return this.func(arg,context,stack);
		}
		eval(stack){return this}
	}
	class Int extends Number{
		constructor(value){
			super(value|0);
		}
		static Part1 = class IntPart extends Exp{
			constructor(value,arg_f){
				super();
				this.value = value;//:Number|Int
				this.foo = arg_f;//:Lazy
			}
			call(arg_x,context,stack){
				let ans = arg_x;
				for(let i = 0;i<this.value;i++){
					ans = this.foo.call(ans,context,stack);
				}
				return ans;
			}
			eval(){return this}
		};
		static increment = new class Increment extends Exp{
			//n> f>x>f(n f x)
			call(arg,context,stack){return new Int((arg|0)+1)??this.lazyExpVersion.call(arg)};
			eval(stack){return this};
			lazyExpVersion=new Lambda(new Lambda(new Lambda(1,[2,1,0])));
		};
		call(arg_f){//f>x>
			return new this.constructor.Part1(this,arg_f);
		}
		eval(){return this}
	}
	class Calc extends Func{//calculation
		constructor(func,args=[],stack=undefined){
			super(func)//func:(...Number[])->Number
			this.args = args;//:Lazy[]
			if(args.length>=func.length){
				const ans = this.func(...args.map(v=>Lazy.toInt(v,stack)));
				const nullValue = Lambda.null;
				return typeof ans == "number"?isNaN(ans)?nullValue:new Int(ans):ans??nullValue;//can return custom Exp objects.
			}
		}
		//isOperater:bool&Operator?
		call(arg,context,stack){//Int->Int-> ... Int-> Int
			return new this.constructor(this.func,[...this.args,arg],stack)
		}
		eval(stack){return this}
	}
	class List extends Array{
		constructor(...list){
			super(list.length);
			Object.assign(this,list);
		}
		call(arg,context,stack){
			return this.concat(arg,context,stack);
		}
		eval(){return this}
		get = Object.assign(new Calc(index=>this[index|0]),{id:List.get.id});
		concat = Object.assign(new Func((list,context,stack)=>stack.doOnStack(list,
			(list=list.eval())instanceof List?Object.assign(new List(...this,...list),{id:this.id}):
			Object.assign(new List(...this,list),{id:this.id})//'[1 2] 3' => '[1 2] [3]' => '[1 2 3]'
		)));
		list = [];
		static get = {id:undefined};//is defined later
		static get_expression = {id:undefined};//is defined later
	}
	class Reference extends Exp{//wrapper for Lazy
		constructor(value,levelDif,id){
			super();
			this.value=value;//:Exp
			this.levelDif=levelDif;//:Number
			this.id = id;//:Number
		}
		call(arg,context=new Context,stack){
			//context??= new Context();
			stack.unshift(this.id);
			let value = Object.assign(new Lazy,this.value);
			value.context=context.getContext(this.levelDif);
			let ans = value.call(arg,context,stack);
			stack.shift();
			return ans;
		}
		eval(stack){return this.value.eval(stack);}
	};
	//const Y = new Lambda(new Lambda(0,0),new Lambda(new Lambda(2,0),[0,0]));
	let Y = new Lambda(new Lambda(1,[0,0]),new Lambda(1,[0,0]));
	let vec2 = new Lambda(new Lambda({x:1,y:0}));//x>y>{x y}
	let recur = new Lambda();
//----
function loga(...logs){console.log(...logs)}
const files={
	getDataFromID:[],//Map(id => Data{line,column,file,word})
	list:new Map([]),//Map(fileName => FileData)
	FileData:class FileData extends Exp{//data for errors
		constructor(data){super();Object.assign(this,data);}
		//note these properties are not used in the Expression classes.
		text;//:string
		id;//:number
		words;//:string[]
		tree;//:tree([string,id,FileData])
		lines;//:string[]
		context;//:BracketPattern
		expression;//:Lazy
		get value(){return this.expression}//:Exp
		throwError(id,type,errorMessage,error,stack){//error = str=>Error(str)
			//note: lines and colums are counted from 1
			if(!TEST)error=a=>a;
			throw error(
				"lc++ ERROR:\n"
				//"l:"+data.line+" c:"+data.column+"\n"
				// " ".repeat(lineLen)+" |\n"
				+this.displayWordInLine(id,type+" error")+"\n"
				+"error"+": "+errorMessage+"\n"
				+(!stack?"":
					"stack:\n"
					+stack.map(v=>files.getDataFromID[v].file.displayWordInLine(v,"at")).join("\n")
				)
			);
		}
		displayWordInLine(id,msg){
			let data = files.getDataFromID[id];
			let line = this.lines[data.line-1];
			let whiteSpace = line.match(/^[\t ]*/)?.[0]??"";
			let whiteLen = whiteSpace.length;//,data.column-1);
			line = line.substr(whiteLen)//[whiteSpace,line]
			let lineLen = (""+data.line).length;
			return ""
				+data.line+" |" +line+"\n"
				+" ".repeat(lineLen)+" |" +" ".repeat(data.column-1-whiteLen)+"^".repeat(data.word.length)+" "+msg
			;
		}
		call(arg,context = new Context,stack = new Stack){return this.value.call(arg,context,stack)??Lambda.null}
		eval(stack = new Stack){return this.value.eval(stack)??Lambda.null}
	},
	addInbuilt(obj,name="SOURCE"){
		let word = "SOURCE:[ "+name+" ]";
		obj.id = this.getDataFromID.push({
			line:1,column:1,word,
			file:new this.FileData({expression:obj,lines:[word]}),
		})-1;
		return obj;
	}
};
{
	[
		[Int.prototype,"Int"],
		[Calc.prototype,"Calc"],
		[Func.prototype,"Function"],
		[Int.increment,"increment"],
		[List.get,"List.get"],
		[List.get_expression,"(list)> bool>bool head tail {head tail} = list,"]
	].forEach(v=>files.addInbuilt(v))
}
function compile (text,fileName){
	if(typeof text != "string")throw throwError_noLine("basic API","'compile' requires a string input as the source code.",a=>Error(a));
	//types
		//syntax, reference
	fileName??=(()=>{
		for(let [fileName,value] of files.list.entries())
			if(value.text == text)return fileName;
		return undefined;
	})(); 
	if(fileName!=undefined&&files.list.has(fileName)){
		return files.list.get(fileName).context;
	}
	function throwError_noLine(type,errorMessage,error){
		return error(
			"lc++ ERROR:\n"
			+type+" error"+"\n"
			+errorMessage
		);
	}
	function treeParse(words){
		let list = [];
		let stack = [];
		for(let i=0;i<words.length;i++){
			let word = words[i];
			let value = [word,fileID+i,file];
			if(word.match(/^\//))list.push(value);
			else if(word.match(/[(\[{]/)){
				stack.push(list);
				list.push(value,list = []);
			}
			else if(word.match(/[)\]}]/)){
				list = stack.pop();
				if(!list)file.throwError(i,"syntax", "unballanced brackets: Too many closing brackets", a=>Error(a));
				//assert: list[list.length-2] exists
				let openBracket = list[list.length-2][0];
				if(({"(":")", "[":"]", "{":"}"})[openBracket]!=word)file.throwError(i,"syntax", "unmatching brackets:'"+openBracket+"..."+word+"'", a=>Error(a));
				list.push(value);
			}
			else list.push(value);
		}
		if(stack.length>0)file.throwError(fileID+words.length-1,"syntax", "unballanced brackets: Too many opening brackets", a=>Error(a));
		return list;
	}
	function parseContexts(tree){
		//classes & consts
			const numberRegex = /^(?:[0-9]+(\.[0-9]*)?|0x[0-9a-fA-F]+(\.[0-9a-fA-F]*)?|0b[01]+(\.[01]*)?)$/;
			const getWord = (tree,i)=>tree[i]?.[0]??"";
			const getID = (tree,i)=>tree[i]?.[1];
			class Pattern{
				constructor(data){
					Object.assign(this,data);
				}
				id;//:[]SyntaxTree
				type="operator";//:"operator"|"word"|"number"|"symbol"|"function"|"assignment"
				parent;//:BracketPattern
				isFirst;//:bool ; Is true if this is the start of a list, or can be used as the starting function.
				//optionals
					pattern;//:?String & word
					options;//:?String & joined words
					params;//:?(String & word) | Tree<String>
					list;
			}
			class Simple extends Pattern{
				constructor(data){super();Object.assign(this,data)}
				//pattern:undefined;
				set parent(v){this.#parent=v}
				get parent(){return this.#parent}
				#parent;
				arg;//:String
				type;
				value;//:Code
				ref;//:Param?
			}
			class BracketPattern extends Pattern{
				constructor(data){super();Object.assign(this,data)}
				parent;
				pattern='()';//'()'|'[]'|'{}'
				list=[];//:Tree<Pattern> ; brackets only
				id;//:index in getDataFromID
			}
			class Pattern_extra{
				startLabels;//:Map(String,Ref)
				currentLabels;//:Map(String,Ref)
				refs;//:Set(Pattern) & Tree(Pattern)
				refLevel;//:Number
				funcLevel;//:Number ; number of nested lambdas
			};
			class Param{
				constructor(data){Object.assign(this,data)}
				name;//:[String,Number] ; name of the parameter or label
				index;//:number ; if a pattern has muli parameters it shows which one it is.
				owner;//: Pattern & context with a {list:Array} ; is the expression that the label bellongs to
				value;//: Lazy? ; only for assignment patterns
			}
			const comma = {};
		//----
		const match_pattern_arg = ({tree,i,pattern})=>{//'a' or '$1' 
			let oldI=i;
			let getObj = ()=>({i,id:tree[oldI][1],type:"argument",pattern});
			if(!pattern){
				let word;
				if((word=getWord(tree,i))=="$"){
					pattern = "$";
					++i;
					if(getWord(tree,i).match(numberRegex)){
						let params = [tree[i]];
						++i;
						return new Pattern({...getObj(),params})
					}
					else {i=oldI;pattern = ""}
					return new Pattern({...getObj()})
				}
				else if(word.match(numberRegex)){
					pattern = word;
					i++;
					let match = new Simple({...getObj(),arg:word});
					match.type="number";
					return match;
				}
				else if(word.match(/^\w+$/)){
					pattern = word;
					i++;
					let match = new Simple({...getObj(),arg:word});
					return match;
				}
			}
			return ;
		}
		const match_pattern = (tree,i)=>{//Number->String
			//note: If there's no pattern property, then no pattern was found and the object is disguarded.
			let id = tree[i][1];
			let pattern = "";
			let options="";//'()=' '()<=>'
			let params=[];//:Tree|[String,Number]
			let hasOwnContext=false;
			let type="operator";
			let oldI=i;
			if(!pattern){
				let word = getWord(tree,i);
				if(word=="<"){ //'< a' or '< a $ n'
					++i;
					if(getWord(tree,i).match(/\w+/)){
						pattern = "<";
						type = "return";
						params = [tree[i]];
						++i;
					}
					if(getWord(tree,i)){
						++i;
					}
				}
				//if(getWord(tree,i+1)=="::"){} UNFINISHED
			}
			if(!pattern){
				hasOwnContext=true;
				options="";
				if(getWord(tree,i)=="?"){options+="?";++i}
				if("\\λ".includes(getWord(tree,i))){pattern="λ";id=getID(tree,i);type="function";list=[];++i}
			}
			if(!pattern){//function and assignment | 'with' block | 'use' block
				i=oldI;
				options="";
				hasOwnContext=true;
				{//assign params
					if("([{".includes(getWord(tree,i)||undefined)){
						options+=getWord(tree,i)+"..."+getWord(tree,i+2);
						let forEachSyntaxTree=tree=>(foo,s0)=>{
							let s = s0;
							return function traverse(foo,tree){
								for(let i=0;i<tree.length;i++){
									if("([{".includes(tree[i][0])){
										traverse(foo,tree[++i]);
										i++;
									}
									else{
										s=foo(tree[i],i,tree);
									}
								}
							}
						};
						params = [];// [a b c] = 
						tree[i+1].forEach((v,i,word)=>typeof(word=getWord(tree,i))=="string" && !"()[]{}".includes(word)?params.push(word):0);
						i+=3;
					}
					else params = [tree[i++]];
				}
				if(getWord(tree,i)=="?"){options+="?";++i}
				if(getWord(tree,i)==">"){options+=pattern=">";id=getID(tree,i);++i;type="function";}
				else {
					if(getWord(tree,i)=="<"){options+="<";++i}
					if(getWord(tree,i)=="="){options+=pattern="=";id=getID(tree,i);++i;type="assignment";}
					if(getWord(tree,i)==">"){options+=">";++i}
				}
				if(options.includes("(")&&pattern){//()> or ()=
					pattern = "()=";//use and with blocks are counted as with blocks
					type = "with";//{">"}[options.match(/(?<=\)).*$/)];
				}
			}
			if(!pattern){//set recur
				hasOwnContext=false;
				i=oldI;
				if(getWord(tree,i)=="::" && i>0){
					pattern = "::";
					type = "recursion";
					hasOwnContext = true;
					++i;
				}
			}
			if(!pattern){
				hasOwnContext=false;
				i=oldI;
				options="";
				let match = match_pattern_arg ({tree,i});
				if(match)return match;
			}
			let match = new Pattern({pattern,options,params,id,type,...(hasOwnContext?{list:[]}:{}),i});
			if(params)match.params.forEach((v,i,a)=>a[i]=new Param({name:v,index:i,owner:match}));
			return match;
		}
		const removeIndents=num=>{//removes indentation from strings '""'
			let word = tree[num];
			if(!word.match("\n"))return word;
			let indentNum = (word.match(/\n\s*/g)??[]).reduce((s,v)=>Math.min(s,v.length),Infinity);
			return word.split("\n").reduce((s,v)=>s+v.substr(indentNum));
		};
		function* getPatterns(tree,bracketContext){
			let context = bracketContext;
			let word;
			let isFirst=true;
			tree = tree.filter((v,i)=>typeof v[0]!="string"||!getWord(tree,i)?.match?.(/^(\s*|\/\*[\s\S]*\*\/|\/\/.*)$/));
			for(let i=0;i<tree.length;){
				word = getWord(tree,i);
				let match = match_pattern(tree,i);
				if(match.pattern||(match instanceof Simple)){
					({i}=match);
					match.parent = context;
					context.list.push(match);
					match.isFirst=isFirst;
					if(match.list){
						context=match;
						isFirst=true;
					}
					else isFirst=false;
					yield match;
					continue;
				}
				else if("([{".includes(word)){
					let id = tree[i][1];
					++i;
					let bracket=new BracketPattern({pattern:{"(":"()","[":"[]","{":"{}"}[word],list:[],parent:context,isFirst,id});
					yield bracket;
					context.list.push(bracket);
					yield*getPatterns(tree[i],bracket);
					++i;
				}
				else if(")]}".includes(word)){
					return;
				}
				else if(word == ","){
					//yield comma;
					//context.push(comma);
					let id = tree[i][1];
					context = new BracketPattern({pattern:",",parent:bracketContext,list:[],isFirst,id});
					yield context;
					bracketContext.list.push(context);
					isFirst=true;
				}
				else {
					let match = new Simple({id:tree[i][1],arg:word,type:"symbol",parent:context,isFirst})
					yield match;
					context.list.push(match);
				};
				i++
				isFirst=false
			}
		}
		let context = new BracketPattern;
		[...getPatterns(tree,context)];//mutates context
		function* forEachTree(context,getTree){//isTree:node->Tree?
			const tree = getTree(context);
			for(let i=0;i<tree.length;i++){
				let [v,a] = [tree[i],context];
				yield [v,i,a];
				yield*forEachTree(v,getTree);
			}
		}
		const forEachPattern = ()=>forEachTree(context,v=>v?.list??[]);
		function addRefParam(match,match_parents,param){
			//match:Pattern
			//match_parents:Set(BracketPattern)
			//param:Param
			let higherParamParent = param.owner;//:Pattern
			let argParentIndex;
			//assume: there is not an infinite chain of Pattern.parent's
			if(param.owner.type=="function"||param instanceof Operator)return;//functions can't form ref loops, since it is garantied that `match_parents.includes(param.owner) == true`
			while(
				higherParamParent
				&& -1 == (argParentIndex = match_parents.indexOf(higherParamParent.parent))
			){higherParamParent = higherParamParent?.parent};
			if(argParentIndex==-1)throw Error("compiler error");
			if(!higherParamParent)throw Error("compiler error");
			let higherArgParent = match_parents[argParentIndex-1];
			if(argParentIndex==0){//e.g. '(a a=2)'
				//UNTESTED: unknown behaviour: may not reference errors, where there should be
				return;
			}
			if(!higherArgParent)throw Error("compiler error");
			if(higherParamParent.parent!=higherArgParent.parent)throw Error("compiler error");
			{//check for and prevent reference loops
				if(higherParamParent.refs?.has?.(higherArgParent))file.throwError(match.id,"illegal reference","recursive/self reference, detected using label '"+match.arg+"'. These are not allowed",a=>Error(a))
			}
			//note:
				//From now on only things from block 'arg' can reference block 'param'
				//and never the other way around.
				//Otherwise a reference error is thrown.
			//----
			//adds new reference.
			if(!higherArgParent.refs){
				higherArgParent.refs=new Set;//:Set(Pattern)
				higherArgParent.refLevel??=(higherParamParent.refLevel??-1)+1;
				higherParamParent.refLevel??=higherArgParent.refLevel-1;
			}
			if(higherArgParent.refLevel<=higherParamParent.refLevel)file.throwError(match.id,"illegal reference","complex recursive/self reference, detected using label '"+match.arg+"'. These are not allowed",a=>Error(a));
			higherArgParent.refs.add(higherParamParent);
		}
		function getParam(name,parent,parents=[]){//parents:Pattern[]?
			let param = 
				parent?.currentLabels?.get?.(name)
				??(p=>parents.includes(p?.owner)?undefined:p)(parent?.startLabels?.get?.(name))
			;
			parents?.push?.(parent);
			return param?
				{param,parents}:
				parent.parent?
					getParam(name,parent.parent,parents)
					:undefined
			;
		}
		class Operator extends Param{
			constructor(name,priority,foo,length=2){
				super({name:[name,-1],priority,owner:context,value:foo});
				this.value.operatorParamObj = this;//:truthy
				this.length = length;
			}
			isParsed=false;
			//name:[String,Number]
			//index:Number
			//owner:Pattern
			//value:Lazy
			//priority:Number
			//length:Number
		}
		let maxPriority;
		{
			//applies to Patterns with type = "operator"
			context.value = new Lazy;
			let i=0;
			const bool_true = new class True extends Lambda{}(new Lambda(1));
			const bool_false = new class False extends Lambda{}(new Lambda(0));//new Int(0);
			const equality = (a,b)=>//(Exp,Exp)-> Lambda bool
				(a=a.eval())==(b=b.eval())?bool_true
				:a instanceof Array?
					!(b instanceof Array)?bool_false
					:!(a.constructor == b.constructor)?bool_false
					:a.length != b.length?bool_false
					:a.reduce((s,v,i)=>s==bool_false?s:equality(a[i],b[i]),bool_true)
				:b instanceof Array?equality(b,a)
				:+a==+b?bool_true//assume: NaN!=NaN
				:bool_false
			;
			context.startLabels= new Map([
				//TODO: allow '!!a' -> '(! (! a))'
				["!" ,  i,new Func((a,context,stack)=>Lazy.toInt(a,stack)==0||a==Lambda.null?bool_true:bool_false),1],
				["~" ,  i,new Calc((a)=>~a),1],
				["++",  i,new Calc((a)=>a+1),1],
				["--",  i,new Calc((a)=>a-1),1],
				["&" ,++i,new Calc((a,b)=>a&b),2],
				["|" ,  i,new Calc((a,b)=>a|b),2],
				["^" ,  i,new Calc((a,b)=>a^b),2],
				["%" ,  i,new Calc((a,b)=>a%b),2],
				["**",  i,new Calc((a,b)=>a**b),2],
				["*" ,++i,new Calc((a,b)=>a*b),2],
				["/" ,  i,new Calc((a,b)=>a/b),2],
				["+" ,++i,new Calc((a,b)=>a+b),2],
				["-" ,  i,new Calc((a,b)=>a-b),2],
				["==",++i,new Func(a=>new Func(b=>equality(a,b))),2],
				["<" ,  i,new Calc((a,b)=>a<b?bool_true:bool_false)],
				[">" ,  i,new Calc((a,b)=>a>b?bool_true:bool_false)],
				[">=",  i,new Calc((a,b)=>a>=b?bool_true:bool_false)],
				["<=",  i,new Calc((a,b)=>a<=b?bool_true:bool_false)],
				["&&",++i,new Lambda(new Lambda(1,0,1)),2],
				["||",  i,new Lambda(new Lambda(1,1,0)),2],
				["^^",  i,new Lambda(new Lambda(1,[0,bool_false,1],0)),2],
			].map(v=>[
				[files.addInbuilt(v[2],v[0]),v[2].name=v[0],v=new Operator(...v)][2].name[0],v
			]));
			maxPriority= i;
		}
		function parseNumber(word){
			let base = word[1]=="b"?2:word[1]=="x"?16:10;
			return !isNaN(+word)?+word:(([a,b])=>+a+b/base**b.length)(word.split("."));
		}
		//mutates context
		(function getAssignments(){
			//find definisions
			for(let [match,i,bracketParent] of forEachPattern()){
				match.funcLevel = match.parent?.funcLevel || 0;
				let lastValue = match.isFirst?undefined:bracketParent[i-1];// ','
				if(match.pattern == "="){//assignment
				if(bracketParent.pattern==","){
					{//set up assignment properties
						bracketParent.startLabels ??= new Map();//String|Number => Param
						bracketParent.currentLabels ??= new Map();
						bracketParent.refs ??= new Set();//:Set(BracketPattern) where p.refs.get(x).refs.get(p) == undefined
					}
					bracketParent=bracketParent.parent;
				}
					//assume: bracketParent == match.parent
					{//set up assignment properties
						bracketParent.startLabels ??= new Map();//String|Number => Param
						bracketParent.currentLabels ??= new Map();
						bracketParent.refs ??= new Set();//:Set(BracketPattern) where p.refs.get(x).refs.get(p) == undefined
					}
					let startLabels=bracketParent.startLabels;
					let i=0;
					match.value = new Lazy;//single value, represents the right side of the assignment.
					for(let param of match.params){//param:Param
						if(!startLabels.has(param))startLabels.set(param.name[0],param);
						param.value = match.value;
					}
				}
				else if(match.type == "recursion"){
					match.value = new RecurSetter();
				}
				else if(match.type == "function"){//assume pre-fix
					if(match.pattern==">")match.startLabels = new Map(match.params.map(v=>[v.name[0],v]));
					match.funcLevel++;
					match.value = new Lambda
				}
				else if(match.pattern == "()="){//with/use
					match.value = bracketParent.value;
				}
				else if(match instanceof BracketPattern){
					if(match.pattern=="()" || match.pattern == ","){
						match.value = [];
					}
					if(match.pattern=="[]"){
						match.value = new List;
					}
					if(match.pattern=="{}"){
						match.value = [];
					}
				}
				if(match.value){
					match.value.id = match.id;
				}
			}
			//find and link references
			for(let [match,i,bracketParent] of forEachPattern()){
				let lastValue = match.isFirst?undefined:bracketParent[i-1];// ','
				if(match.pattern == "="){//assignment
					for(let param of match.params){
						match.parent.currentLabels.set(param.name[0],param);
					}
				}
				else if(match.type == "function"){//function
					match.parent.value.push(match.value);
				}
				else if(match.type == "argument" || match.type == "symbol" || match.type == "number"){
					if(match.pattern == "$"){
						match.value = parseNumber(match.params[0][0]);
						if(typeof match.value == "number"){//lambda parameter
							//validate value
							if(match.value>match.funcLevel){
								file.throwError(match.id,"reference","the parameter number exceeds the amount of global scopes",a=>Error(a));
							}
						}
					}
					else{
						let {param,parents} = getParam(match.arg,match.parent)??{};
						if(match.type!="number"){
							//note: number literals & other predefined values can be used as either an Int or a parameter reference
							if(!param){
								file.throwError(match.id,"reference","label: '"+match.arg+"' is undefined",a=>Error(a));
							}
							addRefParam(match,parents,param);
							//assert: param != undefined
							match.ref = param;
							if(param.owner.type == "function"){
								let refLevel = match.funcLevel-param.owner.funcLevel;
								if(param.owner.options[0]=="{"){//is multi assign namespace
									match.value = new Lazy(new Dot(param.name[0]),refLevel);
								}
								else if(param.owner.options[0]=="["){//is multi assign list
									match.value = new Lazy(List.get,refLevel,new Int(param.index));
								}
								else{
									match.value = refLevel;
								}
							}
							else if(param.owner.type == "assignment"){
								const paramValue = param.value;
								const levelDif = match.funcLevel-param.owner.funcLevel;
								match.value = new Reference(paramValue,levelDif,match.id);
							}
							else{
								match.value = param.value;
							}
							if(match.value==undefined)throw Error("compiler error");
						}
						else if(!param){//if not overwritten && is number literal
							match.value = new Int(parseNumber(match.arg));
						}
					}
					match.parent.value.push(match.value);
				}
				else if(match.type=="recursion"){
					match.parent.value.push(match.value);
				}
				else if(match instanceof BracketPattern){
					match.parent.value.push(match.value);
				}
			}
			//find recursion patterns 'r ::'
			for(let [match,i,bracketParent] of forEachPattern()){
				if(match.pattern=="::"){
					let index = match.parent.value.indexOf(match.value);
					if(index>0)match.value.recur = match.parent.value.splice(index-1,1)[0];
					else throw Error("compiler error");
					match.parent.value.splice(index+1,0,...match.value.splice(1,match.value.length-1));
				}
			}
			//remove empty commas caused by assignments e.g. '(a=1,b=2,a)' -> '(a=1,(b=2),(a))' -> '(()(a))' -> '(a)'
			for(let [match,i,bracketParent] of forEachPattern()){
				if(match.pattern==","){
					let index = match.parent.value.indexOf(match.value);
					if(match.value.length == 0 && bracketParent[i+1]?.pattern != ",")//if(match.list.length>0 && match.value.length==0)
						while(match.parent.value.includes(match.value)){
							match.parent.value.splice(match.parent.value.indexOf(match.value),1);
						}
					if(match.value.length == 1 || index == 0){
						match.parent.value.splice(index,1,...match.value);
					}
				}
			}
			//handle operator priorities
			for(let [value,i] of 
				function*(){
					yield [context.value,0];
					yield*forEachTree(context.value,
						v=>
						v instanceof RecurSetter?[[v.recur],...v]:
						v instanceof Reference?v.value:
						v instanceof Array?v:
						[]
					);
				}()
			){
				if(!(value instanceof Array && value.length>0))continue;
				let list = value;
				for(let priority=0;priority<maxPriority+1;priority++){
					for(let i=0;i<list.length;i++){
						//'a+b' -> '((+)a b)'
						//'~a' -> '((~)a) '
						let operator = list[i];
						if(!(operator.operatorParamObj instanceof Operator))continue;
						if(!(operator.operatorParamObj.priority == priority))continue;
						let foo = operator.func;
						let paramLen = operator.operatorParamObj.length;
						let useLeftArg = paramLen == 2;
						if(i<list.length-1)//has right argument
						if(i>0 && !operator.operatorParamObj.isFirst){
							let newOperation = Object.assign([operator],{id:operator.id});
							let splice=list.splice(i-useLeftArg,paramLen+1);
							newOperation.push(...(paramLen==2?[splice[0],splice[2]]:[splice[1]]));
							list.splice(i-useLeftArg,0,newOperation);
							i-=useLeftArg;
							//'a + b' -> '(+ a b)'
							//'! a' -> '(! a)'
						}
					}
				}
			}
		}());
		return context;
	}
	let regex =/\s+|\/\/.*|\/\*[\s\S]*\*\/|λ|\b(?:[0-9]+(?:\.[0-9]*)?|0x[0-9a-fA-F]+(?:\.[0-9a-fA-F]*)?|0b[01]+(?:\.[01]*)?)\b|\b\w+\b|"[^"]*"|::|(?:[!%^&*-+~<>])=|([+\-*&|^=><])\1?|[^\s]/g;
	let lines = text.split("\n");
	const fileID = files.getDataFromID.length;
	const words = text.match(regex)??[];
	const file = new files.FileData({text,words,lines,id:fileID});
	files.list.set(fileName,file);
	words.reduce((s,v,i)=>{
		s.word = v;
		let id = files.getDataFromID.length;
		files.getDataFromID.push(s);
		s = {...s};
		if(v.match("\n")){
			s.line += (v.match(/\n/g)?.length??0);
			s.column = (v.match(/(?<=\n).+$/)?.[0]?.length??0)+1;//assume: column >= 1
		}
		else s.column+=v.length;
		return s;
	},{line:1,column:1,file,word:"",recurs:0,maxRecur:Infinity});
	let main=()=>{
		const tree = treeParse(words);
		const context = parseContexts(tree);
		const expression = context.value;
		Object.assign(file,{tree,context,expression})
		return file;//parse(tree);
	}
	return main();
}
function tryCatch (foo,throwError,exceptionValue){
	throwError??=console.log;
	if(TEST){
		return foo();
	}
	else try{//main
		return foo();
	}catch(error){
		throwError(error);
		return exceptionValue;
	}
}
tryCatch(()=>{//λ
	let s = new Stack;
	loga(compile(`
		_=(
			i = n>n(++)0,
			Y = 10::f>r (x>f(x x)) r=a>a a,
			factorial = (Y !>x> x == 0 1 (x * (!,--x))),
			factorial 4,
		),
		10::((a>a a)(a>a a))
	`).value.eval()//.call(new Func(v=>[loga(v.eval()),v][1]))
	);
});