# PCB 设计工业级核心术语与术语表 (PCB Design Industrial Glossary)

| 术语 (Term) | 英文全称 / 标准定义 | 核心物理概念与设计准则 | 详见章节 |
| :--- | :--- | :--- | :--- |
| **AC 耦合电容** | Alternating Current Coupling Capacitor | 串联在高速差分线上阻断直流偏置、只允许高频交流信号通过的电容，焊盘下方需开窗挖空以防阻抗突变。 | Ch 04, Ch 08 |
| **Anti-pad (反焊盘)** | Anti-pad / Copper Relief | 在内层铜箔平面上围绕过孔或焊盘开设的无铜隔离环，超高速下适当扩大反焊盘可减小寄生电容。 | Ch 02, Ch 08 |
| **Back-drilling (背钻)** | Controlled Depth Drilling | 采用控深钻孔技术去除通孔过孔中未使用的多余铜柱残桩（Stub），消除高频谐振陷波。 | Ch 08 |
| **BGA** | Ball Grid Array (球栅阵列) | 高密度集成电路封装，引脚呈阵列状分布在芯片底部，采用狗骨扇出（Dog-bone）或盘中孔扇出。 | Ch 02 |
| **Blind Via (盲孔)** | Blind Via | 仅连接 PCB 表层与某一内层、不贯通整块板卡的过孔，用于 HDI 高密板。 | Ch 02 |
| **Buried Via (埋孔)** | Buried Via | 完全位于 PCB 内部层之间、在成品板表面不可见的过孔。 | Ch 02 |
| **CC 线** | Configuration Channel (配置通道) | Type-C 接口中用于协商连接方向、供电角色（Source/Sink）及功率档位（PD协议）的关键控制线。 | Ch 04 |
| **Clearance (电气间隙)** | Electrical Clearance | 两相邻导电体之间穿过空气测得的最短空间直线距离，受 IPC-2221B 标准管控。 | Ch 01 |
| **CMRR** | Common Mode Rejection Ratio (共模抑制比) | 衡量差分放大器或传输系统抑制外部共模电磁噪声能力的指标。 | Ch 05, Ch 06 |
| **Creepage (爬电距离)** | Creepage Distance | 沿绝缘材料固体表面测得的两个导电体之间的最短路径。 | Ch 01, Ch 05 |
| **Crosstalk (串扰)** | Electromagnetic Crosstalk | 走线间的电磁互感与互容引起的非预期信号耦合，通过 3W 规则与完整地平面抑制。 | Ch 02, Ch 09 |
| **DFM** | Design for Manufacturability (可制造性设计) | 在研发设计阶段系统性规避制造端开短路、酸角、破环、焊锡不良等品质缺陷的工程方法。 | Ch 01, Ch 10 |
| **DFT** | Design for Testability (可测试性设计) | 为保障电路板批量自动化生产中 ICT/FCT 测试而合理规划测试点（Test Point）的设计准则。 | Ch 10 |
| **Dog-bone Fanout** | 狗骨式扇出 | BGA 焊盘通过一小段短走线斜向引出到过孔的扇出图形，外形酷似狗骨。 | Ch 02 |
| **DP** | DisplayPort | 高带宽数字音视频差分传输总线，DP1.4 单通道速率达 8.1Gbps。 | Ch 04 |
| **DRC** | Design Rule Check (设计规则检查) | EDA 工具自动验证走线、过孔、焊盘是否满足工厂制造工艺与电气间隙参数的算法。 | Ch 01, Ch 10 |
| **eDP** | Embedded DisplayPort | 面向笔记本与便携设备液晶面板内部互联的嵌入式 DisplayPort 协议。 | Ch 04 |
| **EMC** | Electromagnetic Compatibility (电磁兼容性) | 电子设备在自身正常工作的同时不对所处环境中的其他设备产生不能承受的电磁骚扰。 | Ch 09 |
| **EMI** | Electromagnetic Interference (电磁干扰) | 导电回路产生的电磁场对其他信号引起的传导或辐射骚扰。 | Ch 09 |
| **ENIG** | Electroless Nickel Immersion Gold (化学沉镍金) | 表面处理工艺，化学镀镍 3~5μm + 沉浸纯金 1~2U"，极高平整度，适合 QFN/BGA。 | Ch 01, Ch 10 |
| **ESD** | Electrostatic Discharge (静电放电) | 带有不同静电电位的物体互相靠近或直接接触引起的电荷瞬间转移转移脉冲。 | Ch 09 |
| **Fiber-Weave Effect** | 玻纤编织效应 | PCB 玻纤布经纬纱线束与环氧树脂介电常数差异导致差分对产生不对称时延（Skew）的高频效应。 | Ch 08 |
| **Fly-by 拓扑** | 飞越拓扑 | 地址、命令与控制信号呈链式串联依次飞越各内存颗粒、末端接入 VTT 端接电阻的高速拓扑。 | Ch 07 |
| **FR-4** | Flame Retardant 4 | 玻璃纤维环氧树脂覆铜板，当前工业界应用最广泛的阻燃绝缘基板材料。 | Ch 01, Ch 08 |
| **Guard Ring (保护环)** | Guard Ring / Ground Shield | 围绕高阻抗敏感节点或高频振荡晶振的一圈封闭接地铜线，用于截获漏电流与屏蔽电磁干扰。 | Ch 06 |
| **HASL** | Hot Air Solder Leveling (热风整平/喷锡) | 传统低成本表面处理工艺，表面平整度欠佳，不适宜密集细间距 QFN/BGA。 | Ch 01, Ch 10 |
| **HDI** | High Density Interconnector (高密度互连) | 采用微盲埋孔技术（孔径 $\le 0.15	ext{mm}$）制造的高密度印制电路板。 | Ch 02 |
| **HDMI** | High-Definition Multimedia Interface | 高清多媒体接口，传输 TMDS 差分信号，差分阻抗标称 100Ω。 | Ch 04 |
| **Impedance (阻抗)** | Characteristic Impedance (特征阻抗) | 高频信号沿传输线传播时所受到的瞬态阻抗，单端标准为 50Ω，差分常见 90/100Ω。 | Ch 02, Ch 04 |
| **IR Drop** | Direct Current Voltage Drop (直流压降) | 大电流流经铜箔导线的固有欧姆电阻时产生的电压损耗，需加宽电源铜皮以抑制。 | Ch 03 |
| **Keepout Area** | 禁布区 | 在机械结构层或电气层设定的禁止布线、打孔或放置元器件的空间边界。 | Ch 01 |
| **LDO** | Low Dropout Regulator (低压差线性稳压器) | 采用晶体管线性调控降低直流电压的稳压器，噪声低、纹波极小，但效率受压差限制。 | Ch 03 |
| **LPDDR4** | Low Power Double Data Rate 4 | 面向低功耗便携设备的高速内存标准，传输速率达 3200~4266 MT/s。 | Ch 07 |
| **LVDS** | Low-Voltage Differential Signaling (低压差分信号) | 采用约 350mV 低摆幅、100Ω 终端电阻的高速低功耗差分视频与数据接口。 | Ch 04 |
| **Microstrip (微带线)** | Microstrip Line | 位于 PCB 顶层或底层、仅有一侧紧邻参考平面的表面高频传输线。 | Ch 02, Ch 06 |
| **MIPI** | Mobile Industry Processor Interface | 移动行业处理器接口，涵盖 CSI（摄像头）与 DSI（显示屏）高速串行差分规范。 | Ch 04, Ch 05 |
| **MLCC** | Multi-Layer Ceramic Capacitor (多层片状陶瓷电容) | 常用贴片滤波电容，易受机械形变应力导致脆裂短路，布局需远离应力集中区。 | Ch 01, Ch 03 |
| **NSMD** | Non-Solder Mask Defined (非阻焊定义焊盘) | 阻焊开窗大于铜箔焊盘尺寸，铜箔侧壁暴露以增加焊锡附着浸润面积，BGA 焊盘优选。 | Ch 02 |
| **OSP** | Organic Solderability Preservatives (有机保焊膜) | 在裸铜表面通过化学反应生长一层有机耐热防氧化保护膜。 | Ch 01, Ch 10 |
| **PCIe** | Peripheral Component Interconnect Express | 高性能点对点串行计算机扩展总线，采用 85Ω 或 100Ω 差分传输。 | Ch 05 |
| **PMU** | Power Management Unit (电源管理单元) | 集成多路高频 Buck、Boost 及数十路 LDO 的集成化电源管理芯片。 | Ch 03 |
| **POD12** | Pseudo Open Drain 1.2V | DDR4 内存采用的伪开漏 1.2V 逻辑电平标准，端接至 VDDQ，显著降低功耗。 | Ch 07 |
| **QFN** | Quad Flat No-leads (无引脚四方扁平封装) | 底部中央有裸露大接地焊盘、四周引脚间距密（0.4/0.5mm）的紧凑表面贴装封装。 | Ch 01, Ch 02 |
| **Return Path (返回路径)** | Signal Return Path | 高频信号沿传输线正向传输时，其伴随镜像高频回流在相邻参考平面上流过的物理回路。 | Ch 02, Ch 09 |
| **RJ45** | Registered Jack 45 | 标准 8P8C 网络接口，千兆网内集成网络变压器隔离与 100Ω 差分匹配。 | Ch 05 |
| **RS485** | Recommended Standard 485 | 采用平衡发送和差分接收的半双工工业总线标准，共模电压范围宽（-7V~+12V）。 | Ch 05 |
| **SATA** | Serial Advanced Technology Attachment | 串行硬盘接口，采用 100Ω 高速差分点对点连接，速率达 6Gbps。 | Ch 05 |
| **Skin Effect (集肤效应)** | Skin Effect | 随信号频率升高，交变电流趋向于仅在导体表面极薄的表层中流过的物理效应。 | Ch 02, Ch 08 |
| **SMD** | Solder Mask Defined (阻焊定义焊盘) | 阻焊层开窗小于铜箔焊盘，由阻焊漆覆盖焊盘四周边缘来定义最终焊接面积。 | Ch 02 |
| **Stripline (带状线)** | Stripline | 位于 PCB 内层、上下两侧均有完整导体参考平面的对称/不对称传输线。 | Ch 02, Ch 08 |
| **Stub (桩线/短线)** | Transmission Line Stub | 从主传输线上引出的未端接或多余悬空的分支导线段，超高速下引起致命共振反射。 | Ch 02, Ch 08 |
| **SW 节点** | Switch Node (开关节点) | DC-DC 转换器中电感与高低边开关管交汇的高频脉冲电压跳变节点，强 EMI 辐射源。 | Ch 03 |
| **TDR** | Time Domain Reflectometry (时域反射计) | 通过注入极快阶跃脉冲并测量反射波形以精确分析传输线上阻抗不连续点的仪器方法。 | Ch 08 |
| **Teardrop (泪滴)** | Teardrop | 在导线进入焊盘或过孔处添加的平滑过渡渐宽三角形铜膜，增强抗应力与阻抗连续性。 | Ch 01, Ch 02 |
| **TVS** | Transient Voltage Suppressor (瞬态抑制二极管) | 在瞬态大电压浪涌下纳秒级雪崩导通、将过电压钳位在安全范围的静电保护器件。 | Ch 09 |
| **Type-C** | USB Type-C | 支持正反盲插、高达 100W/240W 供电及 40Gbps 吞吐的全功能 24-Pin 接口标准。 | Ch 04 |
| **V-CUT** | V-groove Scoring (V割) | 在拼板分板边界处从双面铣出 V 形预割槽以方便后续折板分离的工艺。 | Ch 01, Ch 10 |
| **Via in Pad (盘中孔)** | Via-in-Pad Plated Over (VIPPO) | 直接打在表贴元件焊盘内的通孔，必须做树脂塞孔与电镀填平磨平以防漏锡。 | Ch 02, Ch 10 |
| **20H 原则** | 20H Rule | 电源层边缘相比临近参考地层向内回缩 20 倍介质层厚度，将 70% 的边缘射频辐射约束在板内。 | Ch 02, Ch 09 |
| **3W 原则** | 3W Rule | 走线中心间距不小于 3 倍线宽时，可使导体间的边缘电磁耦合串扰降低 70%。 | Ch 02, Ch 09 |\n